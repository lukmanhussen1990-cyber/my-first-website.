"""Key moments of the salt reel (absolute seconds on the user's voiceover), shared by make_words.py (comic words +
arrow labels), fx.py (camera hits, salt, shakes) and make_sfx.py (sounds); offsets inside a shot match the 3D
animation in scene/shots.js."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_W = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
_L = json.load(open(os.path.join(HERE, "audio", "vo_lines.json")))["lines"]
_S = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}
DUR = json.load(open(os.path.join(HERE, "shots.json")))["duration"]


def word(line, idx=0):
    return [w for w in _W if w["line"] == line][idx]["s"]


def line(i):
    return _L[i - 1]["start"], _L[i - 1]["end"]


def shot(i):
    return _S[i]["t0"], _S[i]["t1"]


T = dict(
    shake=shot(1)[0], shake2=shot(2)[0],
    slap=shot(4)[0] + 0.37,
    lid=shot(6)[0] + 0.62,
    dump=shot(7)[0] + 0.05,
    fuck=line(6)[0],
    pokes=[shot(9)[0] + (0.25 + k) / 4.0 for k in range(5)] + [shot(10)[0] + (0.25 + k) / 2.2 for k in range(4)],
    slow=shot(11)[0],
    clock=shot(12)[0],
    cold=shot(13)[0],
    tape=shot(15)[0],
    proud=shot(16)[0],
    dial=[shot(17)[0] + 0.3 + k * 0.11 for k in range(11)],
    vrrr=shot(18)[0],
    boom=shot(19)[0] + 0.15,
    white=shot(20)[0],
    blink=[shot(21)[0] + 0.55, shot(21)[0] + 1.35],
    fry=shot(21)[0] + 0.8,
)
