"""Key moments of the reel (absolute seconds), shared by make_sfx.py (sounds), overlays.py (pop-up words, the
LIVE view counter, notifications) and fx.py (punch-ins, shakes), so a sound, its word and its camera hit together.
Times come from the voiceover words (audio/word_onsets.json) and the shot cuts (shots.json); the offsets inside a
shot match the 3D animation in scene/shots.js."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_W = json.load(open(os.path.join(HERE, "audio", "word_onsets.json")))
_S = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}
DUR = json.load(open(os.path.join(HERE, "shots.json")))["duration"]


def word(line, idx=0):
    return [w for w in _W if w["line"] == line][idx]["s"]


def shot(i):
    return _S[i]["t0"], _S[i]["t1"]


T = dict(
    tumble=shot(1)[0],
    bulb_out=shot(2)[0] + 0.55,
    live=shot(3)[0] + 0.45,                     # the phone switches to LIVE
    plop=shot(4)[0] + 1.1,                      # the blob lands
    views_1k=word(5, 0),
    ding=word(5, 0) + 0.45,
    shrug=shot(6)[0] + 1.45,
    squish=shot(7)[0] + 0.55,
    smile_drop=shot(8)[0] + 0.2,
    gasp=shot(9)[0] + 0.12,
    views_1m=word(10, 0),
    stadium=shot(10)[0],
    ooh=shot(12)[0] + 0.05,
    views_50m=word(12, 0),
    heli=shot(14)[0],
    gulp=shot(15)[0] + 0.35,
    fwoosh=shot(16)[0] + 0.8,
    hero=shot(17)[0],
    drop=shot(18)[0],
    umbrellas=shot(19)[0] + 0.15,
    splat_u=[shot(19)[0] + 0.45 + k * 0.22 for k in range(3)],
    thwaps=[shot(20)[0] + x for x in (0.3, 0.9, 1.5)],
    news=shot(21)[0],
    whizz=shot(21)[0] + 0.35,
    splat_n=shot(22)[0] + 0.08,
    blink=shot(24)[0] + 0.35,
    views_1b=word(24, 0),
    kaching=word(24, 0) + 0.5,
    fanfare=shot(26)[0],
)
