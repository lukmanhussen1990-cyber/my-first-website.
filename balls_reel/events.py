"""Key moments of the balls-double reel (absolute seconds on the voiceover), shared by fx.py (camera hits, labels)
and make_sfx.py (sounds). The offsets inside a shot match scene/shots.js."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_P = json.load(open(os.path.join(HERE, "shots.json")))
_S = {s["id"]: s for s in _P["shots"]}
DUR = _P["duration"]


def shot(i):
    return _S[i]["t0"], _S[i]["t1"]


def at(i, lt):
    return _S[i]["t0"] + lt


T = dict(
    land=at(3, 0.47), ding40=at(3, 0.82),                         # the two small balls land on the kitchen scale, 40 g
    waddle=[at(6, k * 0.419) for k in range(1, 6) if k * 0.419 < shot(6)[1] - shot(6)[0]],
    onscale=at(7, 0.6), ding41=at(7, 1.1),
    strain=at(9, 0.05),
    crack=at(10, 0.32),
    sit=at(11, 0.0),
    tanks=at(13, 0.0), soldiers=at(14, 0.0), aim=at(14, 0.75 * (shot(14)[1] - shot(14)[0])),
    pull=at(15, 0.0), ping=at(16, 0.1),
    big=at(17, 0.0),
    news=at(19, 0.0),
    jam=at(20, 0.0), mom=at(21, 0.0),
    crush=at(22, 0.0),
    slam=at(25, 0.38),
    space=at(26, 0.0), pull_in=at(27, 0.0),
    flash=shot(28)[1], hole=at(29, 0.0),
    quiet=at(30, 0.0), end=at(31, 0.0),
)
