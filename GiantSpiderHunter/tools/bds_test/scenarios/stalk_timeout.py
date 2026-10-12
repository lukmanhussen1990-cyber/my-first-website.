"""Stalking timeout: an ignored stalker eventually grows and hunts (encounters never stall)."""
from _common import fast_config, platform, wait_state

DESCRIPTION = "stalk timeout -> hunt"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=12, lookSeconds=600, approachRange=2)
    y = platform(h)
    p = h.spawn("Ignorer", x=0, y=y, z=0)
    p.hold(0.5, y, 0.5)
    p.look_at(0.5, y + 1, -40, mode="continuous")
    h.summon(0.5, y, 25.5)
    h.check(wait_state(h, "stalking", 15), "stalking")
    t0 = h.mark("waiting for timeout")
    g = wait_state(h, ["growing", "hunting"], 30)
    t1 = h.mark("grew")
    h.check(g and 8 <= t1 - t0 <= 25, "timeout triggers growth after ~12 s", seconds=round(t1 - t0, 1))
