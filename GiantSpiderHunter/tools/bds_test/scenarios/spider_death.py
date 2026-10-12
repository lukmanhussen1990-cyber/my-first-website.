"""Killing the giant: dying state (death animation), loot, despawn, encounter ends."""
from _common import SPIDER, fast_config, platform, state, wait_state

DESCRIPTION = "health buffer -> dying -> loot + despawn"


def run(h):
    fast_config(h, autoSpawn=False, health=40, deathLootDelaySeconds=3)
    y = platform(h)
    p = h.spawn("Slayer", x=0, y=y, z=-25, gm="survival")
    h.summon(0.5, y, 0.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting")
    for i in range(6):
        h.call("entityHurt", check=False, target={"type": SPIDER}, amount=15, by="Slayer")
        h.wait(0.6)
    d = wait_state(h, "dying", 8)
    h.check(d, "spider enters the dying state instead of vanilla death")
    gone = h.wait_until(lambda hh: not hh.spiders(hh.snap()), 15, desc="despawn after death")
    h.check(gone, "spider despawns after the death sequence")
    items = h.call("entities", check=False, type="minecraft:item")
    n = items.get("total", 0) if isinstance(items, dict) else 0
    h.check(n >= 1, "loot dropped", items=n)
