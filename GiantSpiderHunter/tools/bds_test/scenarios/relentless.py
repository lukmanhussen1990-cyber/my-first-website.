"""Relentless mode: escape disabled, only leaving/dying/creative ends the chase."""
from _common import fast_config, platform, state, wait_state

DESCRIPTION = "relentless: distance does not end the chase"


def run(h):
    fast_config(h, autoSpawn=False, relentless=True, growthDurationSeconds=2)
    y = platform(h)
    p = h.spawn("Doomed", x=0, y=y, z=-20)
    h.summon(0.5, y, 0.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting")
    h.cmd(f"fill 85 {y - 1} 85 95 {y - 1} 95 stone")
    p.hold(90, y, 90)
    h.wait(20)
    s = h.spiders(h.snap())[0]
    h.check(state(s) == "hunting", "still hunting 20 s after the player got far away", state=state(s))
    h.set_config("relentless", "false")
