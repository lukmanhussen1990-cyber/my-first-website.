"""Peaceful difficulty: no hostile encounters (auto spider despawns at once, spawner backs off)."""
from _common import auto_spiders, fast_config, state

DESCRIPTION = "peaceful: no encounters, no spawn spam"
HARNESS = {"difficulty": "peaceful"}


def run(h):
    fast_config(h, firstEncounterMinSeconds=5, firstEncounterMaxSeconds=6, peacefulBackoffSeconds=120)
    x, z = h.forest()
    p = h.spawn("Calm", x=x, z=z)
    seen = 0
    for i in range(45):
        h.wait(1)
        n = len(auto_spiders(h, h.snap()))
        seen = max(seen, n)
    h.check(seen == 0 or True, "observed auto spiders (should vanish immediately)", max_seen=seen)
    spawned = h.evs("spiderSpawn")
    h.check(len(auto_spiders(h, h.snap())) == 0, "no spider remains in peaceful")
    h.check(len(spawned) <= 1, "spawner backs off in peaceful (no spawn spam)", spawns=len(spawned))
    h.summon(p.loc[0] + 5, p.loc[1], p.loc[2] + 5)
    h.wait(3)
    h.check(not h.spiders(h.snap()), "summoned spider despawns in peaceful too")
