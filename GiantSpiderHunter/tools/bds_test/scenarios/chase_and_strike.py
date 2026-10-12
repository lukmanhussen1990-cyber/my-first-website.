"""Chase: the giant pursues a fleeing player fast and strikes only within its real reach."""
import math
from _common import SPIDER, fast_config, hdist, platform, spider_hurts, state, wait_state

DESCRIPTION = "pursuit speed, strikes only within reach, damage applied"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=600, lookSeconds=0.4)
    y = platform(h, half=90)
    p = h.spawn("Runner", x=0, y=y, z=-60)
    h.summon(0.5, y, -40.5)
    h.check(wait_state(h, "stalking", 15), "stalking")
    p.look_at_entity(target={"type": SPIDER}, mode="continuous")
    h.check(wait_state(h, "hunting", 15), "hunting")
    t0 = h.mark("run!")
    # run straight away (south, +z) sprinting
    p.look_at(0.5, y + 1, 200, mode="continuous")
    p.sprint(True)
    p.move(1.0, 0.0, 1.0)
    samples = []
    for i in range(24):
        h.wait(0.5)
        snap = h.snap()
        pl = h.player("Runner", snap)
        sp = h.spiders(snap)
        if pl and sp:
            samples.append((h.now(), pl["loc"], sp[0]["loc"], pl["hp"], state(sp[0])))
    p.stop()
    if len(samples) >= 4:
        (ta, _, sa, _, _), (tb, _, sb, _, _) = samples[1], samples[-1]
        speed = hdist(sa, sb) / max(0.1, tb - ta)
        h.note(f"giant chase speed {speed:.2f} blocks/s")
        h.check(speed >= 5.0, "giant pursues fast (>= 5 blocks/s)", speed=round(speed, 2))
    hurts = spider_hurts(h, "Runner", since=t0)
    h.note(f"{len(hurts)} strikes on Runner")
    # every strike must happen while the player is within reach (distance recorded with each hurt)
    bad = [ev.get("distH") for ev in hurts if ev.get("distH") is not None and ev["distH"] > 12.5 * 1.4 * 1.15 + 1]
    h.note("strike distances (horizontal): " + str([ev.get("distH") for ev in hurts]))
    h.check(not bad, "no strike from outside the reach", far=bad)
    h.check(len(hurts) >= 1, "the giant lands at least one strike on a sprinting player", hurts=len(hurts))
    last = samples[-1] if samples else None
    h.check(last and last[3] < 20, "player health dropped", hp=last and last[3])
