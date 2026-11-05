"""Key moments of the bed-shake reel (absolute seconds on the voiceover), shared by fx.py and make_sfx.py.
The offsets inside a shot match scene/shots.js."""
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


def cut(i):
    return _S[i]["t0"] + (_S[i]["cuts"][0] if _S[i]["cuts"] else 0.0)


def _every(i, period, start=0.0, end=None):
    t0, t1 = shot(i)
    out, t = [], t0 + start
    while t < (t1 if end is None else t0 + end) - 0.02:
        out.append(round(t, 3)); t += period
    return out


T = dict(
    shake=at(1, 0.0), run=at(3, 0.12), door=at(3, 0.1), outside=at(4, 0.0),
    hammer=_every(7, 1 / 3.2, 1 / 3.2), floor=at(8, 0.0), chand=at(9, 0.0), macarena=at(10, 0.0),
    clank=_every(11, 0.35, 0.1), bolts=[at(12, i * 0.08 + 0.05) for i in range(9)], building=at(13, 0.0), crack=cut(13),
    news=at(14, 0.0), carry=at(15, 0.0), basement=at(16, 0.5), train=at(17, 0.0), screech=at(18, 0.0), ding=at(19, 0.05),
    drum=_every(20, 0.5, 0.0), beat=_every(21, 0.25, 0.0), sofa=at(22, 0.0), dance=at(23, 0.0), party=at(24, 0.0), genius=at(25, 0.0),
)
