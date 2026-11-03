"""Key moments of the doctor reel (absolute seconds), shared by make_sfx.py and fx.py so each sound, camera hit and
effect lands together. Times come from the user's voiceover words and the shot cuts; offsets inside a shot match
the 3D animation in scene/shots.js."""
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
    x_marks=[shot(2)[0] + k * 0.27 for k in range(4)],
    x_five=shot(3)[0] + 0.15,
    wobble=shot(5)[0],
    gasp=shot(7)[0] + 0.15,
    touch=shot(7)[0] + 0.55,
    chime=shot(8)[0] + 0.7,
    press=shot(9)[0] + 0.25,
    boing=shot(9)[0] + 0.74,
    shine=shot(11)[0] + 0.55,
    sparkle=shot(13)[0] + 0.1,
    pills=[shot(16)[0] + 0.37 + i * 0.28 for i in range(3)],
    tick=shot(19)[0] + 0.4,
    freeze=shot(21)[0] + 0.3,
    rumble=shot(22)[0],
    loud=shot(24)[0],
    reactions=[shot(i)[0] for i in (25, 26, 27, 28)],
    run=shot(29)[0],
    line_ppl=shot(30)[0],
    # fists hit the door every pi/18 s (scene/shots.js: sin(lt*18) flips), the phase restarts at each cut
    bangs=[shot(i)[0] + k * 3.14159 / 18 for i in (33, 34) for k in range(int((shot(i)[1] - shot(i)[0]) / (3.14159 / 18)) + 1)
           if shot(i)[0] + k * 3.14159 / 18 < shot(i)[1] - 0.03],
    ticks=[t for t in (shot(19)[0] + 0.4 + k * 0.5 for k in range(-4, 5)) if shot(18)[0] < t < shot(21)[0]],
    creak=shot(35)[0] + 0.05,
    reveal=shot(36)[0],
    happens=shot(38)[0],
    scratch=shot(41)[0] - 0.05,
    silence=shot(41)[0],
    stampede=shot(42)[0],
    empty=shot(43)[0],
    writing=shot(46)[0],
    fifty=line(38)[0],
    five_hundred=line(40)[0],
)
