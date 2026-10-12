"""Escape: getting far away ends the chase (cooldown), and the spider stops attacking."""
from _common import SPIDER, fast_config, platform, spider_hurts, state, wait_state

DESCRIPTION = "escape by distance -> cooldown -> despawn/stalk"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=600, lookSeconds=0.4,
                postChaseCooldownSeconds=10, cooldownRestalkRange=20)
    y = platform(h)
    p = h.spawn("Escaper", x=0, y=y, z=-20)
    h.summon(0.5, y, 0.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting")
    t0 = h.mark("teleport 90 blocks away")
    h.cmd(f"tickingarea add 80 {y - 1} 80 100 {y - 1} 100 gsh_far true")
    h.cmd(f"fill 85 {y - 1} 85 95 {y - 1} 95 stone")
    h.wait(1)
    p.hold(90, y, 90)
    c = wait_state(h, ["cooldown", "stalking", "idle"], 15)
    t1 = h.mark("escaped")
    h.check(c, "chase ends after getting far away", state=c and state(c))
    h.check(c and t1 - t0 <= 12, "escape detected within a few seconds", seconds=round(t1 - t0, 1))
    if c:
        h.check(c["props"].get("horror:giant") in (False, 0), "shrinks back to the small form")
    hurts = spider_hurts(h, "Escaper", since=t1)
    h.check(not hurts, "no strikes after escaping")
