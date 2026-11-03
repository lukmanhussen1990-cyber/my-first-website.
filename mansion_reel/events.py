"""Key moments of the mansion reel (absolute seconds on the user's voiceover), shared by make_words.py (comic words
+ DAY labels), fx.py (camera hits, hearts, sparkles) and make_sfx.py (sounds), so a word, its sound and its camera
hit land together. Times come from the word onsets (audio/word_onsets.json) and the shot cuts (shots.json); offsets
inside a shot match the 3D animation in scene/shots.js."""
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


PI = 3.14159265
T = dict(
    rumble=shot(2)[0] + 0.4,
    bad=line(3)[0],
    run_toilet=shot(4)[0],
    rattle=shot(5)[0] + 0.15,
    tsk=shot(7)[0] + 0.1,
    mansion=shot(9)[0],
    knocks1=[shot(10)[0] + (0.5 + k) / 3.5 for k in range(3)],          # the fist hits the door when sin <= 0
    door_open1=shot(11)[0],
    slam=shot(13)[0] + 0.6,
    knocks2=[shot(14)[0] + (0.5 + k) / 6.0 for k in range(8)],
    door_open2=shot(15)[0] + 0.05,
    owner=shot(16)[0],
    kneel=shot(17)[0] + 0.05,
    smile=shot(20)[0] + 0.55,
    stairs=shot(22)[0],
    happy=shot(23)[0],
    kiss=shot(24)[0] + 0.3,
    hearts1=shot(25)[0] + 0.1,
    run=shot(26)[0],
    golden=shot(27)[0],
    plop=shot(28)[0] + 0.38,
    chand=shot(29)[0],
    heart_stairs=shot(32)[0],
    day2=shot(33)[0], day30=shot(36)[0], day60=shot(39)[0], day100=shot(46)[0], day200=shot(48)[0], day365=shot(53)[0],
    years5=shot(62)[0],
    door_in=shot(36)[0],
    eyeroll=shot(38)[0] + 0.15,
    yawn=shot(40)[0],
    zzz=shot(41)[0],
    wake=shot(42)[0] + 0.25,
    hearts_couch=shot(44)[0] + 0.12,
    paris=shot(48)[0],
    love1=line(37)[0], love2=line(38)[0],
    kneel2=shot(55)[0],
    box_open=shot(57)[0] + 0.15,
    diamond=shot(59)[0],
    yes=line(43)[0],
    wedding=shot(61)[0],
    kids=shot(63)[0],
    potty=shot(64)[0],
    night=shot(65)[0],
    family=shot(66)[0],
    love3=shot(67)[0] + 0.15, love4=shot(68)[0],
    started=shot(69)[0], poop_end=shot(70)[0],
)
