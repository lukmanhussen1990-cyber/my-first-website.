"""Compile the scene plan into timelines, then draw any instant t.

Rendering is a pure function of t (all randomness is seeded by element id and
the boil frame), so frames can be rendered in parallel and in any order.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

import numpy as np

from . import rig
from .align import norm
from .captions import Captions
from .ink import GROUND_Y, Canvas, background_surface
from .props import PROPS

CUT = 0.32  # cross-fade length for transition="cut"


def _back(u):
    c1 = 1.9
    return 1 + (c1 + 1) * (u - 1) ** 3 + c1 * (u - 1) ** 2


def _bounce(u):
    n, d = 7.5625, 2.75
    if u < 1 / d:
        return n * u * u
    if u < 2 / d:
        u -= 1.5 / d
        return n * u * u + 0.75
    if u < 2.5 / d:
        u -= 2.25 / d
        return n * u * u + 0.9375
    u -= 2.625 / d
    return n * u * u + 0.984375


EASE = {
    "linear": lambda u: u,
    "inout": lambda u: u * u * (3 - 2 * u),
    "out": lambda u: 1 - (1 - u) ** 3,
    "in": lambda u: u ** 3,
    "back": _back,
    "bounce": _bounce,
    "step": lambda u: 1.0 if u > 0 else 0.0,
}
ENTER_DUR = {"pop": 0.30, "fade": 0.30, "rise": 0.40, "draw": 0.60, "drop": 0.55, "none": 0.0}
EXIT_DUR = {"fade": 0.25, "pop": 0.22, "sink": 0.30, "none": 0.0}
DEFAULT_Z = {"arrow": 9, "buzz": -2, "glow": 7, "ground": -10, "grass": -9, "sun": -8, "tree": -7, "chair": -5, "table": -5, "box": -3, "clock": -3,
             "meter": -3, "calendar": 3, "eyeline": 1, "battery": 2, "brain": 2, "cloud": 2, "bulb": 3,
             "floaters": 4, "sketch": 4, "paper": 4, "phone": 5, "book": 5, "pencil": 6, "heart": 6, "orb": 8,
             "qmark": 9, "tick": 9, "label": 10, "bookmark": 12}
SFX_FOR_ENTER = {"pop": "pop", "drop": "thud", "rise": "soft"}
TWEEN_DEFAULTS = {"alpha": 1.0, "screen": 1.0, "scale": 1.0, "level": 1.0, "check": 1.0, "draw": 1.0,
                  "text_alpha": 1.0, "outline_alpha": 1.0, "scribble": 1.0, "label_alpha": 1.0, "ghost_alpha": 0.75,
                  "number": 1, "underline_draw": 1.0}


# ------------------------------------------------------------------ timing
@dataclass
class Scene:
    index: int
    line: str
    words: list
    start: float
    end: float = 0.0
    transition: str = "continue"


def _find_line(line, all_words, from_idx):
    target = [norm(w) for w in line.split()]
    target = [w for w in target if w]
    seq = [norm(w["text"]) for w in all_words]
    for i in range(from_idx, len(seq) - len(target) + 1):
        if seq[i:i + len(target)] == target:
            return i, i + len(target)
    raise ValueError(f"scene line not found in the narration: {line!r}")


_AT = re.compile(r"^(?P<base>@[^+\-]+?|end|start)(?P<off>[+\-]\d+(?:\.\d+)?)?$")


def resolve(at, sc: Scene) -> float:
    if at is None:
        return sc.start
    if isinstance(at, (int, float)):
        return sc.start + float(at)
    m = _AT.match(at.strip())
    if not m:
        raise ValueError(f"bad time {at!r}")
    base, off = m.group("base"), float(m.group("off") or 0)
    if base == "end":
        return sc.end + off
    if base == "start":
        return sc.start + off
    word = base[1:]
    use_end = word.endswith(".end")
    if use_end:
        word = word[:-4]
    nth = 1
    if "#" in word:
        word, n = word.split("#")
        nth = int(n)
    hits = [w for w in sc.words if norm(w["text"]) == norm(word)]
    if len(hits) < nth:
        raise ValueError(f"word {word!r} not in scene line {sc.line!r}")
    w = hits[nth - 1]
    return (w["end"] if use_end else w["start"]) + off


# ------------------------------------------------------------------ timelines
@dataclass
class Track:
    """Piecewise eased transitions of one value: keys = [(t0, dur, target, ease)]."""
    base: object
    keys: list = field(default_factory=list)
    starts: list = field(default_factory=list)

    def finalize(self, mix):
        self.keys.sort(key=lambda k: k[0])
        self.starts = []
        cur = self.base
        for i, (t0, dur, target, ease) in enumerate(self.keys):
            self.starts.append(cur)
            nxt = self.keys[i + 1][0] if i + 1 < len(self.keys) else None
            if nxt is not None:
                u = 1.0 if dur <= 0 else min(1.0, max(0.0, (nxt - t0) / dur))
                cur = mix(cur, target, EASE[ease](u))

    def at(self, t, mix):
        if len(self.starts) != len(self.keys):
            self.finalize(mix)
        k = -1
        for i, key in enumerate(self.keys):
            if key[0] <= t:
                k = i
            else:
                break
        if k < 0:
            return self.base
        t0, dur, target, ease = self.keys[k]
        u = 1.0 if dur <= 0 else min(1.0, max(0.0, (t - t0) / dur))
        return mix(self.starts[k], target, EASE[ease](u))


def _mix(a, b, k):
    if isinstance(a, dict):
        return rig.blend(a, b, k)
    if isinstance(a, tuple):
        return tuple(x + (y - x) * k for x, y in zip(a, b))
    if isinstance(a, bool) or isinstance(a, str) or a is None:
        return b if k >= 0.5 else a
    return a + (b - a) * k


ACTOR_DEFAULTS = dict(x=540.0, y=float(GROUND_Y), pose="stand", face="neutral", facing=1, turn=0.0,
                      look=(0.0, 0.0), alpha=1.0, scale=1.0)


@dataclass
class ActorInst:
    id: str
    uid: str
    t_in: float
    t_out: float = math.inf
    fade_in: float = 0.3
    fade_out: float = 0.3
    tracks: dict = field(default_factory=dict)
    motions: list = field(default_factory=list)
    hair: bool = False
    dashed: bool = False

    def state(self, t):
        return {k: tr.at(t, _mix) for k, tr in self.tracks.items()}


@dataclass
class PropInst:
    id: str
    uid: str
    kind: str
    t_in: float
    t_out: float
    enter: str
    exit: str
    keep: object
    z: float
    hold: tuple | None
    params: dict
    tracks: dict = field(default_factory=dict)
    until_explicit: bool = False


@dataclass
class Plan:
    scenes: list
    actors: list
    props: list
    sfx: list
    duration: float
    captions: Captions
    finale: dict | None = None
    watermark: str | None = None


def _actor_state(state):
    s = dict(state)
    if "pose" in s:
        s["pose"] = rig.pose(s["pose"])
    if "face" in s:
        s["face"] = rig.face(s["face"])
    if "look" in s:
        s["look"] = tuple(s["look"])
    return s


def compile_plan(cfg, voice_meta, words_data) -> Plan:
    words = words_data["words"]
    duration = voice_meta["duration"]
    # ---- scenes
    scenes, idx = [], 0
    for i, sd in enumerate(cfg.SCENES):
        a, b = _find_line(sd["line"], words, idx)
        idx = b
        start = 0.0 if i == 0 else max(0.0, words[a]["start"] - sd.get("lead", 0.12))
        scenes.append(Scene(i, sd["line"], words[a:b], start, transition=sd.get("transition", "continue")))
    for i, sc in enumerate(scenes):
        sc.end = scenes[i + 1].start if i + 1 < len(scenes) else duration

    actors: dict[str, list[ActorInst]] = {}
    props: list[PropInst] = []
    sfx: list[dict] = []
    uid = 0

    def live_actor(aid, t):
        for inst in reversed(actors.get(aid, [])):
            if inst.t_in <= t + 1e-6 and t < inst.t_out:
                return inst
        return None

    def live_prop(pid, t):
        for p in reversed(props):
            if p.id == pid and p.t_in <= t + 1e-6 and t <= p.t_out:
                return p
        return None

    for sc, sd in zip(scenes, cfg.SCENES):
        if sc.transition == "cut" and sc.index > 0:
            for lst in actors.values():
                for inst in lst:
                    if inst.t_out > sc.start:
                        inst.t_out, inst.fade_out = sc.start, CUT
            for p in props:
                if p.t_out > sc.start and p.keep != "always":
                    p.t_out, p.exit = sc.start, "fade"
            sfx.append({"t": sc.start, "name": "whoosh", "gain_db": -6})
        for it in sd["items"]:
            op = it["op"]
            t = resolve(it.get("at", 0), sc)
            if op == "actor":
                st = _actor_state(it["state"])
                inst = live_actor(it["id"], sc.start)
                if inst is None:
                    uid += 1
                    fade = 0.0 if t <= 0 else (CUT if sc.transition == "cut" else 0.3)
                    inst = ActorInst(it["id"], f"{it['id']}#{uid}", t_in=t, fade_in=fade,
                                     hair=st.pop("hair", False), dashed=st.pop("dashed", False))
                    base = _actor_state(ACTOR_DEFAULTS)
                    base.update(st)
                    inst.tracks = {k: Track(v) for k, v in base.items()}
                    actors.setdefault(it["id"], []).append(inst)
                else:
                    st.pop("hair", None)
                    st.pop("dashed", None)
                    for k, v in st.items():
                        inst.tracks[k].keys.append((t, 0.45, v, "inout"))
            elif op in ("act", "walk"):
                inst = live_actor(it["id"], t)
                if inst is None:
                    raise ValueError(f"{op}: actor {it['id']!r} does not exist at {t:.2f}s")
                if op == "act":
                    for k, v in _actor_state(it["state"]).items():
                        inst.tracks[k].keys.append((t, it["dur"], v, it["ease"]))
                else:
                    x0 = inst.tracks["x"].at(t, _mix)
                    inst.tracks["x"].keys.append((t, it["dur"], float(it["to_x"]), "linear"))
                    v = abs(it["to_x"] - x0) / max(it["dur"], 1e-3)
                    stride = min(38.0, max(14.0, v * 0.8 / 4))
                    period = 4 * stride / v if v > 1 else 0.8
                    prm = dict(stride=stride, period=period, **it["params"])
                    inst.motions.append(("walk", t, t + it["dur"], prm))
            elif op == "motion":
                inst = live_actor(it["id"], t)
                inst.motions.append((it["name"], t, t + it["dur"], it["params"]))
            elif op == "add":
                kind = it["kind"]
                until = it["until"]
                keep = it["keep"]
                t_out = resolve(until, sc) if until is not None else (math.inf if keep else sc.end)
                uid += 1
                hold = None
                if it["hold"]:
                    aid, where, off = (list(it["hold"]) + [(0, 0)])[:3]
                    inst = live_actor(aid, t)
                    if inst is None:
                        raise ValueError(f"add {it['id']!r}: holder {aid!r} does not exist at {t:.2f}s")
                    hold = (inst.uid, where, off)
                p = PropInst(it["id"], f"{it['id']}#{uid}", kind, t, t_out, it["enter"], it["exit"], keep,
                             it["z"] if it["z"] is not None else DEFAULT_Z.get(kind, 0), hold,
                             dict(it["params"]), until_explicit=until is not None)
                props.append(p)
                snd = SFX_FOR_ENTER.get(it["enter"]) if it["sfx"] == "auto" else it["sfx"]
                if snd:
                    sfx.append({"t": t, "name": snd, "gain_db": 0.0})
            elif op == "tween":
                p = live_prop(it["id"], t)
                if p is None:
                    raise ValueError(f"tween: prop {it['id']!r} not alive at {t:.2f}s")
                for k, v in it["params"].items():
                    if k not in p.tracks:
                        p.tracks[k] = Track(p.params.get(k, TWEEN_DEFAULTS.get(k, 0.0)))
                    p.tracks[k].keys.append((t, it["dur"], v, it["ease"]))
            elif op == "remove":
                p = live_prop(it["id"], t)
                if p is None:
                    raise ValueError(f"remove: prop {it['id']!r} not alive at {t:.2f}s")
                p.t_out = t
                p.until_explicit = True
                if it["exit"]:
                    p.exit = it["exit"]
            elif op == "sfx":
                sfx.append({"t": t, "name": it["name"], "gain_db": it["gain_db"]})

    for lst in actors.values():
        for inst in lst:
            for tr in inst.tracks.values():
                tr.finalize(_mix)
    for p in props:
        for tr in p.tracks.values():
            tr.finalize(_mix)
    # props that start where an actor's hand/head is at that moment (e.g. a dropped phone)
    for p in props:
        ah = p.params.pop("at_hold", None)
        if ah:
            aid, where, off = (list(ah) + [(0, 0)])[:3]
            inst = next(i for i in actors[aid] if i.t_in <= p.t_in < i.t_out + i.fade_out)
            j = actor_joints(inst, p.t_in)
            ax, ay = (j["hand_a"] + j["hand_b"]) / 2 if where == "hands" else j[where]
            x, y = float(ax + j["facing"] * off[0]), float(ay + off[1])
            for k, v in (("x", x), ("y", y)):
                if k in p.tracks:
                    p.tracks[k].base = v
                    p.tracks[k].starts = []
                p.params[k] = v

    caps = Captions(words, cfg.CAPTION_KEYWORDS, cfg.CAPTION_HIGHLIGHT, cfg.CAPTION_MAX_WORDS)
    finale = getattr(cfg, "FINALE", None)
    if finale:
        last = scenes[-1]
        finale = dict(finale, t=resolve(finale.get("at", "end-1.2"), last))
    all_actors = [inst for lst in actors.values() for inst in lst]
    return Plan(scenes, all_actors, props, sorted(sfx, key=lambda e: e["t"]), duration, caps, finale,
                getattr(cfg, "WATERMARK", None))


def actor_joints(inst: ActorInst, t: float):
    st = inst.state(t)
    p, _ = rig.apply_motions(st["pose"], st["face"], inst.motions, t, inst.uid)
    facing = 1 if st["facing"] >= 0 else -1
    j = rig.solve(p, st["x"], st["y"], facing, st["scale"])
    j["facing"] = facing
    return j


# ------------------------------------------------------------------ drawing
def _enter_fx(kind, u):
    fx = {"alpha": 1.0, "scale": 1.0, "dy": 0.0, "draw": 1.0}
    if kind == "pop":
        fx["scale"] = 0.25 + 0.75 * _back(u)
        fx["alpha"] = min(1.0, u * 3.5)
    elif kind == "fade":
        fx["alpha"] = u
    elif kind == "rise":
        fx["alpha"] = min(1.0, u * 1.6)
        fx["dy"] = 30 * (1 - EASE["out"](u))
    elif kind == "draw":
        fx["draw"] = EASE["inout"](u)
    elif kind == "drop":
        fx["dy"] = -260 * (1 - _bounce(u))
        fx["alpha"] = min(1.0, u * 5)
    return fx


def _exit_fx(kind, u):
    fx = {"alpha": 1.0, "scale": 1.0, "dy": 0.0, "draw": 1.0}
    if kind == "fade":
        fx["alpha"] = 1 - u
    elif kind == "pop":
        fx["scale"] = 1 - 0.7 * EASE["in"](u)
        fx["alpha"] = 1 - u
    elif kind == "sink":
        fx["alpha"] = 1 - u
        fx["dy"] = 24 * u
    elif kind == "none":
        fx["alpha"] = 0.0 if u > 0 else 1.0
    return fx


def prop_state(p: PropInst, t, joints):
    P = dict(p.params)
    for k, tr in p.tracks.items():
        P[k] = tr.at(t, _mix)
    P["tl"] = t - p.t_in
    fx = {"alpha": 1.0, "scale": 1.0, "dy": 0.0, "draw": 1.0}
    ed = ENTER_DUR.get(p.enter, 0.3)
    if ed > 0 and t < p.t_in + ed:
        fx = _enter_fx(p.enter, (t - p.t_in) / ed)
    if t > p.t_out:
        xd = EXIT_DUR.get(p.exit, 0.25) or 1e-3
        e = _exit_fx(p.exit, min(1.0, (t - p.t_out) / xd))
        fx = {"alpha": fx["alpha"] * e["alpha"], "scale": fx["scale"] * e["scale"], "dy": fx["dy"] + e["dy"],
              "draw": fx["draw"]}
    if p.hold:
        huid, where, off = p.hold
        if huid in joints:
            j = joints[huid]
            ax, ay = (j["hand_a"] + j["hand_b"]) / 2 if where == "hands" else j[where]
            P["x"], P["y"] = ax + j["facing"] * off[0], ay + off[1]
            P["facing"] = j["facing"]
        else:
            fx["alpha"] = 0.0
    if p.kind == "orb":  # comet trail: where the orb was a moment ago
        P["trail_x"] = p.tracks["x"].at(t - 0.12, _mix) if "x" in p.tracks else P["x"]
        P["trail_y"] = p.tracks["y"].at(t - 0.12, _mix) if "y" in p.tracks else P["y"]
    P["draw"] = min(P.get("draw", 1.0), fx["draw"])
    if "y" in P:
        P["y"] = P["y"] + fx["dy"]
    return P, fx


class Stage:
    def __init__(self, plan: Plan):
        self.plan = plan

    def frame(self, t: float) -> Canvas:
        cv = Canvas(t)
        cv.cr.set_source_surface(background_surface())
        cv.cr.paint()
        world_alpha = 1.0
        fin = self.plan.finale
        if fin and t > fin["t"]:
            world_alpha = max(0.0, 1 - (t - fin["t"]) / fin.get("fade", 0.5))
        items = []
        joints = {}
        for inst in self.plan.actors:
            if not (inst.t_in <= t < inst.t_out + inst.fade_out):
                continue
            st = inst.state(t)
            p, f = rig.apply_motions(st["pose"], st["face"], inst.motions, t, inst.uid)
            facing = 1 if st["facing"] >= 0 else -1
            j = rig.solve(p, st["x"], st["y"], facing, st["scale"])
            j["facing"] = facing
            joints[inst.uid] = j
            a = st["alpha"]
            if inst.fade_in > 0:
                a *= min(1.0, (t - inst.t_in) / inst.fade_in)
            if t > inst.t_out:
                a *= max(0.0, 1 - (t - inst.t_out) / max(inst.fade_out, 1e-3))
            items.append((0.0, "actor", inst, (st, f, j, a)))
        for p in self.plan.props:
            if not (p.t_in <= t <= p.t_out + EXIT_DUR.get(p.exit, 0.25) + 1e-6):
                continue
            P, fx = prop_state(p, t, joints)
            if fx["alpha"] <= 0.003:
                continue
            items.append((p.z, "prop", p, (P, fx)))
        items.sort(key=lambda it: it[0])
        if world_alpha < 0.999:
            cv.cr.push_group()
        for z, kind, obj, data in items:
            if kind == "actor":
                st, f, j, a = data
                rig.draw_person(cv, j, f, obj.uid, scale=st["scale"], turn=st["turn"] * j["facing"],
                                alpha=a, dashed=obj.dashed, hair=obj.hair, look=(st["look"][0] * j["facing"],
                                                                                 st["look"][1]))
            else:
                P, fx = data
                self._draw_prop(cv, obj, P, fx)
        if world_alpha < 0.999:
            cv.cr.pop_group_to_source()
            cv.cr.paint_with_alpha(world_alpha)
        self.plan.captions.draw(cv, t, fin)
        if self.plan.watermark:
            cv.text(self.plan.watermark, 540, 1572, 36, "#8d8a86", 0.55, jitter=False)
        return cv

    def _draw_prop(self, cv, p, P, fx):
        cr = cv.cr
        cr.save()
        s = fx["scale"]
        if abs(s - 1) > 1e-3:
            ax, ay = P.get("x", 540), P.get("y", 960)
            cr.translate(ax, ay)
            cr.scale(s, s)
            cr.translate(-ax, -ay)
        a = cv.begin(fx["alpha"] * P.get("alpha", 1.0))
        PROPS[p.kind](cv, P, p.uid)
        cv.end(a)
        cr.restore()
