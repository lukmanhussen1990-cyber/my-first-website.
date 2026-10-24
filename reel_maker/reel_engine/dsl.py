"""Tiny vocabulary for the scene plan in make_reel.py.

Times (`at=`) can be:
    0.4            seconds after the scene starts
    "@word"        when that word (in this scene's line) starts; "@word#2" = 2nd occurrence
    "@word.end"    when it ends;  offsets work too: "@word+0.2", "@word.end-0.1"
    "end-0.3"      relative to the end of the scene (= start of the next one)
"""


CUT = "cut"


def scene(line, *items, transition="continue", lead=0.12):
    """A scene starts when `line` starts being spoken (minus `lead` seconds).
    Put CUT first in the items to cross-fade the whole picture into a new set-up;
    otherwise actors and `keep=True` props carry over from the previous scene."""
    if items and items[0] == CUT:
        transition, items = "cut", items[1:]
    return {"line": line, "items": list(items), "transition": transition, "lead": lead}


def actor(id, **state):
    """Create an actor (or snap an existing one) at the scene start.
    state: x, pose, face, facing (1/-1), turn (-1..1 face direction), look=(dx,dy), hair, scale, alpha."""
    return {"op": "actor", "id": id, "state": state}


def act(id, at=0, dur=0.45, ease="inout", **state):
    """Blend an actor into a new pose/face/position."""
    return {"op": "act", "id": id, "at": at, "dur": dur, "ease": ease, "state": state}


def motion(id, name, at=0, dur=1.0, **params):
    """Procedural motion on top of the pose: walk, pat, scribble, laugh, nod, bounce_leg, page_turn, shiver."""
    return {"op": "motion", "id": id, "name": name, "at": at, "dur": dur, "params": params}


def walk(id, to_x, at=0, dur=1.2, **params):
    return {"op": "walk", "id": id, "to_x": to_x, "at": at, "dur": dur, "params": params}


def add(id, kind, at=0, until=None, enter="pop", exit="fade", keep=False, z=None, hold=None, sfx="auto",
        **params):
    """Add a prop. enter: pop | fade | rise | draw | drop | none. exit: fade | pop | none.
    hold=("actor", "hands"|"hand_a"|"hand_b"|"head", (dx, dy)) attaches it to an actor.
    keep=True carries it into following scenes until removed (or a cut)."""
    return {"op": "add", "id": id, "kind": kind, "at": at, "until": until, "enter": enter, "exit": exit,
            "keep": keep, "z": z, "hold": hold, "sfx": sfx, "params": params}


def tween(id, at=0, dur=0.4, ease="inout", **params):
    """Animate prop parameters (level, closed, flip, screen, x, y, ...)."""
    return {"op": "tween", "id": id, "at": at, "dur": dur, "ease": ease, "params": params}


def remove(id, at=0, exit=None):
    return {"op": "remove", "id": id, "at": at, "exit": exit}


def label(text, at=0, y=330, x=540, col="yellow", size=66, box=False, enter="rise", keep=False, id=None, **kw):
    return add(id or f"label:{text}", "label", at=at, enter=enter, keep=keep, text=text, x=x, y=y, col=col,
               size=size, box=box, **kw)


def sfx(name, at=0, gain_db=0.0):
    return {"op": "sfx", "name": name, "at": at, "gain_db": gain_db}


def camera(at=0, dur=1.0, ease="inout", **params):
    """Move the virtual camera: zoom (1 = normal, <1 pulls back), cx/cy = world point kept at screen centre."""
    return {"op": "camera", "at": at, "dur": dur, "ease": ease, "params": params}
