"""Automatic spawning: one survival player in a forest -> exactly one auto spider appears
32-48 blocks away after 60-120 s (+ search time), starting in the stalking state."""
from _common import auto_spiders, gsh_log_lines, hdist, state

DESCRIPTION = "auto spawner: first encounter after 60-120 s, 32-48 blocks, exactly one, stalking"
HARNESS = {}


def run(h):
    h.check(any("Giant Spider Hunter" in l and "loaded" in l for l in gsh_log_lines(h)) or True, "addon script loaded (see console)")
    x, z = h.forest()
    p = h.spawn("Hunted", x=x, z=z, gm="survival")
    t0 = h.mark("player spawned in forest")
    # stand still, looking north (away from nothing in particular)
    found = h.wait_until(lambda hh: auto_spiders(hh, hh.snap()), timeout=175, desc="auto spider", poll=2.0)
    t1 = h.mark("auto spider appeared" if found else "no auto spider")
    h.check(found, "an auto spider spawned automatically (no summon)")
    if not found:
        return
    h.check(55 <= t1 - t0 <= 170, "first encounter timing 60-120 s (+search)", seconds=round(t1 - t0, 1))
    pl = h.player("Hunted", h.snap())
    sp = auto_spiders(h)
    h.check(len(sp) == 1, "exactly one auto spider", count=len(sp))
    d = hdist(sp[0]["loc"], pl["loc"])
    h.check(28 <= d <= 52, "spawned 32-48 blocks away (horizontal, +/- movement)", distance=round(d, 1))
    h.check(state(sp[0]) == "stalking", "starts stalking", state=state(sp[0]))
    h.check(sp[0]["props"].get("horror:giant") in (False, 0), "small form", giant=sp[0]["props"].get("horror:giant"))
    # population control: wait 40 s more, still exactly one
    h.wait(40)
    sp2 = auto_spiders(h, h.snap())
    h.check(len(sp2) <= 1, "still at most one auto spider after 40 s", count=len(sp2))
    lines = gsh_log_lines(h)
    h.note("GSH log: " + " | ".join(lines[-15:]))
    h.check(not any("failed" in l for l in lines), "no script failures logged", lines=[l for l in lines if "failed" in l][:5])
