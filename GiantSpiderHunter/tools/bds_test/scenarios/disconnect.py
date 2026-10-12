"""Disconnect mid-chase: the hunt ends, no duplicate spider when the player comes back."""
from _common import auto_spiders, fast_config, state, wait_state

DESCRIPTION = "player leaves during a chase"


def run(h):
    fast_config(h, firstEncounterMinSeconds=5, firstEncounterMaxSeconds=8, growthDurationSeconds=2, postChaseCooldownSeconds=8)
    x, z = h.forest()
    p = h.spawn("Leaver", x=x, z=z)
    sp = h.wait_until(lambda hh: auto_spiders(hh, hh.snap()), 120, desc="auto spider", poll=1.0)
    h.require(sp, "auto spider spawned")
    h.scriptevent("gsh:grow", player="Leaver")
    h.check(wait_state(h, ["growing", "hunting"], 8), "chase started")
    p.disconnect()
    h.mark("player disconnected")
    h.wait(20)
    s = h.spiders(h.snap())
    h.check(not s or state(s[0]) != "hunting", "no longer hunting after the player left", state=s and state(s[0]))
    p2 = h.spawn("Leaver", x=x, z=z)
    h.wait(20)
    h.check(len(auto_spiders(h, h.snap())) <= 1, "no duplicate auto spider after rejoining")
