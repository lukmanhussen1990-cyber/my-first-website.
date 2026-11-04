"""Key moments of the ghost-girlfriend reel (absolute seconds on the voiceover), shared by fx.py and make_sfx.py.
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
    sputter=at(5, 0.15), dies=at(6, 0.12),                              # the engine coughs, then the car dies (music cut)
    flicker=at(7, 0.0), ghost=at(8, 0.0), jump=at(9, 0.0),
    scream=at(10, 0.0), out=at(11, 0.05), trunk=at(12, 0.0), grab=at(12, 0.75),
    steps=at(13, 0.0), swing=at(14, 0.0), reveal=at(15, 0.2), clank=at(16, 0.72),
    badum=[at(18, 0.038), at(18, 0.19)], stare=at(19, 0.0),
    grave=at(20, 0.0), float=at(22, 0.0), dinner=at(24, 0.0), splat=at(26, 0.38 + 0.42),
    chew=at(27, 0.0), still=at(28, 0.0), park=at(29, 0.0), through=at(31, 0.45),
    hill=at(32, 0.0), propose=at(33, 0.0), rings=[at(34, 0.15 + k * 0.42 + 0.3) for k in range(2)] + [at(35, 0.05 - 0.1 + k * 0.42 + 0.3) for k in range(3)],
    yes=at(36, 0.0), castle=at(37, 0.0), bells=[at(38, 0.1 + k * 0.38) for k in range(3)], hall=at(39, 0.0),
    faint=at(40, 0.95), empty=at(41, 0.0), road=at(42, 0.0), end=at(43, 0.0),
)
