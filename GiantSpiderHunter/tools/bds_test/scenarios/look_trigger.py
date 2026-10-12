"""Look trigger: a stalking spider grows and hunts when a survival player looks at it with line of sight."""
from _common import fast_config, platform, state, wait_state

DESCRIPTION = "looking at the stalker (line of sight) -> growing -> hunting giant"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2.5, stalkTimeoutSeconds=600, lookSeconds=0.6)
    y = platform(h)
    p = h.spawn("Looker", x=0, y=y, z=0)
    p.hold(0.5, y, 0.5)
    h.summon(0.5, y, 22.5)
    s = wait_state(h, "stalking", 15)
    h.check(s, "summoned spider stalks the player", state=s and state(s))
    # look away for 6 s: must NOT trigger
    p.look_at(0.5, y + 1, -30, mode="continuous")
    h.wait(6)
    s = h.spiders(h.snap())[0]
    h.check(state(s) == "stalking", "not triggered while the player looks away", state=state(s))
    t0 = h.mark("player looks at the spider")
    p.look_at_entity(target={"type": "horror:giant_spider"}, mode="continuous")
    g = wait_state(h, ["growing", "hunting"], 8)
    h.check(g, "looking at it triggers growth", state=g and state(g))
    hnt = wait_state(h, "hunting", 8)
    h.check(hnt, "becomes a hunting giant after growing")
    if hnt:
        h.check(hnt["props"].get("horror:giant") in (True, 1), "giant form flag set")
