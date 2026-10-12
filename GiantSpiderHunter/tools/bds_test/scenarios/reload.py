"""Save/reload: an active auto encounter survives a restart without duplicates."""
from _common import auto_spiders, fast_config, state

DESCRIPTION = "server restart mid-encounter -> still exactly one hunter"


def run(h):
    fast_config(h, firstEncounterMinSeconds=5, firstEncounterMaxSeconds=8)
    x, z = h.forest()
    p = h.spawn("Saver", x=x, z=z)
    sp = h.wait_until(lambda hh: auto_spiders(hh, hh.snap()), 120, desc="auto spider", poll=1.0)
    h.require(sp, "auto spider spawned before the restart")
    before = sp[0]
    h.mark("restart")
    h.restart()
    h.wait(10)
    after = auto_spiders(h, h.snap())
    h.check(len(after) == 1, "exactly one auto spider after reload", count=len(after))
    h.wait(30)
    after2 = auto_spiders(h, h.snap())
    h.check(len(after2) <= 1, "still at most one after 30 s", count=len(after2))
