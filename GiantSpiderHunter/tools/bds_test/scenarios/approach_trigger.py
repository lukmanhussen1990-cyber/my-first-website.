"""Approach trigger: walking close to the stalker (without looking at it) makes it grow."""
from _common import fast_config, platform, state, wait_state

DESCRIPTION = "approaching within 10 blocks -> growing"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2.5, stalkTimeoutSeconds=600, lookSeconds=600)
    y = platform(h)
    p = h.spawn("Walker", x=0, y=y, z=0)
    h.summon(0.5, y, 25.5)
    h.check(wait_state(h, "stalking", 15), "stalking")
    p.look_at(0.5, y + 1, -40, mode="continuous")  # face away, walk backwards toward it
    p.move(-1.0, 0.0, 1.0)
    g = wait_state(h, ["growing", "hunting"], 25)
    p.stop()
    h.check(g, "approach triggers growth", state=g and state(g))
