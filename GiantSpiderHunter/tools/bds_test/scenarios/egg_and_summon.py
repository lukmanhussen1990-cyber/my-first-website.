"""Spawn egg and /summon both work (manual spawning is optional, not required)."""
from _common import fast_config, platform, state, wait_state

DESCRIPTION = "spawn egg item + /summon + /summon with horror:spawn_giant"


def run(h):
    fast_config(h, autoSpawn=False)
    y = platform(h)
    p = h.spawn("Tester", x=0, y=y, z=0, gm="creative")
    r = h.call("cmd", name="Tester", command="give @s horror:giant_spider_spawn_egg 1", check=False)
    h.check(r.get("successCount", 0) >= 1 if isinstance(r, dict) else False, "/give horror:giant_spider_spawn_egg works", res=r)
    p.give("horror:giant_spider_spawn_egg", 1, slot=0)
    p.use_on_block(0, y - 1, 6, slot=0, face="Up")
    egg = h.wait_until(lambda hh: hh.spiders(hh.snap()), 6, desc="egg spider")
    h.check(egg, "spawn egg spawns the spider")
    h.cmd("kill @e[type=horror:giant_spider]")
    h.wait(2)
    h.summon(5.5, y, 5.5)
    s = h.wait_until(lambda hh: hh.spiders(hh.snap()), 6, desc="summoned spider")
    h.check(s, "/summon horror:giant_spider works")
    h.cmd("kill @e[type=horror:giant_spider]")
    h.wait(2)
    h.summon(5.5, y, 5.5, event="horror:spawn_giant")
    g = wait_state(h, "hunting", 6)
    h.check(g and g["props"].get("horror:giant") in (True, 1), "/summon ... horror:spawn_giant gives a giant directly")
