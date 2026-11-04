"""Key moments of the exam reel (absolute seconds on the voiceover), shared by make_words.py (pop-up words),
fx.py (camera hits, effects) and make_sfx.py (sounds); offsets inside a shot match scene/shots.js."""
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


STEP = 3.14159 / 5.5          # her heel steps (walk phase lt * 5.5 in scene/shots.js)
T = dict(
    rumble=shot(3)[0] + 0.12,
    flash1=shot(4)[0],
    poop=shot(6)[0],
    plop=shot(9)[0] + 0.85,
    crinkle=shot(12)[0] + 0.05, tight=shot(13)[0] + 0.1, bow=shot(14)[0] + 0.5,
    click=shot(16)[0] + 0.92,
    nod=shot(17)[0] + 0.3,
    rise=shot(18)[0], glint=shot(19)[0] + 0.15,
    open_all=shot(21)[0] + 0.35,
    stomps=[shot(23)[0] + 0.15 + k * STEP for k in range(3)] + [shot(26)[0] + 0.3 + k * STEP for k in range(3)] + [shot(36)[0] + 0.1, shot(36)[0] + 0.65],
    check=shot(24)[0],
    england=shot(28)[0], hit=shot(31)[0] + 0.42, lump=shot(32)[0],
    back=shot(34)[0],
    reach=shot(36)[0] + 0.7,
    creak=shot(37)[0] + 0.2,
    twitch=shot(38)[0] + 0.4,
    snap=shot(39)[0] + 0.38,
    away=shot(40)[0],
    later=shot(41)[0],
    ending=shot(43)[0],
)
