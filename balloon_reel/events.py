"""Key moments of the balloon reel (absolute seconds on the voiceover), shared by fx.py and make_sfx.py.
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


T = dict(
    blow=cut(1), reveal=cut(3), dryer=at(4, 0.0), take=cut(4), vrrr=at(5, 0.0), hot=at(6, 0.0),
    boing=at(7, 0.15), melt=at(8, 0.0), fart=at(9, 0.0), tape=at(10, 0.45), going=at(11, 0.0),
    pump=at(12, 0.0), arm=at(13, 0.0), squish=cut(14), blower=at(15, 0.0), vroom=cut(15), boom=at(16, 0.15), timer=cut(16),
    cat=at(17, 0.0), leap=cut(17), ride=at(18, 0.0), aladdin=at(19, 0.0), genius=at(20, 0.0),
)
