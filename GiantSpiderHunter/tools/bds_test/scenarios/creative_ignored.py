"""Creative and spectator players are ignored completely."""
from _common import SPIDER, fast_config, platform, spider_hurts, state, wait_state

DESCRIPTION = "creative player never triggers/targets/damages"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=8, lookSeconds=0.3)
    y = platform(h)
    p = h.spawn("Builder", x=0, y=y, z=0, gm="creative")
    h.summon(0.5, y, 15.5)
    h.wait(3)
    t0 = h.mark("creative player stares and walks up")
    p.look_at_entity(target={"type": SPIDER}, mode="continuous")
    p.move(1.0, 0.0, 1.0)
    h.wait(6)
    p.stop()
    h.wait(10)
    s = h.spiders(h.snap())
    h.check(s and state(s[0]) in ("idle", "stalking", "cooldown"), "spider never grows/hunts for a creative player",
            state=s and state(s[0]))
    h.check(not spider_hurts(h, "Builder", since=t0), "creative player never damaged")
    # summon a giant directly: it must not attack the creative player either
    h.summon(5.5, y, 5.5, event="horror:spawn_giant")
    h.wait(8)
    h.check(not spider_hurts(h, "Builder", since=t0), "hunting giant ignores creative player")
