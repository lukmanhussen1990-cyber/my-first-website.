"""Beat-synced key moments of the Flash POV reel (video seconds). From audio/beats.json (librosa) and shots.json."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
BJ = json.load(open(os.path.join(HERE, "audio", "beats.json")))
B = BJ["beats"]
_S = {s["id"]: s for s in json.load(open(os.path.join(HERE, "shots.json")))["shots"]}
DUR = json.load(open(os.path.join(HERE, "shots.json")))["duration"]
DROP = BJ["drop"]                                    # "drink for me" (= B[7])


def shot(i):
    return _S[i]["t0"], _S[i]["t1"]


FLASH = [B[1], B[5], B[7], B[11], B[12], B[13], B[14], B[16], B[18]]      # lightning + thunder (same list as scene/shots.js)
T = dict(
    buzz=B[2] + 0.02, msg=B[2] + 0.12, wide=B[4] + 0.55,
    drop=DROP, steps=[B[11], B[12], B[13], B[14]], zooms=[B[15], B[16], B[17], B[18], B[19]],
    screech=B[20], knocks=[B[20] + 0.62 + k * 0.25 for k in range(3)], dad=B[22], freeze=B[23], fizzle=B[23] + 0.55,
    song_end=B[22],
)
