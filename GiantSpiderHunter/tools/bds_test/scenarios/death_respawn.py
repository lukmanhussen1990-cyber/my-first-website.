"""Player death: the chase stops, the respawned player gets a grace period (no immediate attacks)."""
from _common import fast_config, platform, spider_hurts, state, wait_state

DESCRIPTION = "player death -> cooldown, respawn grace, no repeated immediate attacks"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, respawnGraceSeconds=60, postChaseCooldownSeconds=20)
    y = platform(h)
    h.cmd(f"setworldspawn 30 {y} 30")
    p = h.spawn("Victim", x=0, y=y, z=-12)
    h.summon(0.5, y, 0.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting")
    p.kill()
    t0 = h.mark("player killed")
    c = wait_state(h, ["cooldown", "idle", "stalking"], 10)
    h.check(c, "spider stops hunting when its target dies", state=c and state(c))
    h.wait(2)
    p.respawn()
    h.wait(3)
    t1 = h.mark("respawned")
    h.wait(25)
    hurts = spider_hurts(h, "Victim", since=t1)
    h.check(not hurts, "no attacks on the respawned player during the grace period", hurts=len(hurts))
    s = h.spiders(h.snap())
    h.check(not s or state(s[0]) != "hunting", "not hunting the respawned player", state=s and state(s[0]))
