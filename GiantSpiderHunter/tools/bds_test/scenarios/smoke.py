"""Harness self-test: no addon. Spawn a simulated player, move it, read it back, restart."""
NEEDS_ADDON = False
DESCRIPTION = "harness self-test (simulated player, movement, probes, restart)"


def run(h):
    x, z = h.forest()
    p = h.spawn("Smoke", x=x, z=z)
    h.wait(2)
    st = h.player("Smoke", h.snap())
    h.check(st is not None and st.get("loc") is not None, "player probed", state=st)
    start = st["loc"]
    p.move(1.0, 0.0, 1.0)
    h.wait(3)
    p.stop()
    st2 = h.player("Smoke", h.snap())
    moved = ((st2["loc"][0] - start[0]) ** 2 + (st2["loc"][2] - start[2]) ** 2) ** 0.5
    h.check(moved > 1.0, "player moved", moved=moved)
    h.check(st2.get("gm") == "survival", "player is survival", gm=st2.get("gm"))
    h.restart()
    st3 = h.player("Smoke", h.snap())
    h.check(st3 is not None, "player back after restart", state=st3)
