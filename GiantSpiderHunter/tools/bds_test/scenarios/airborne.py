"""Airborne targets: struck when genuinely within the giant's reach, never from far below/away."""
from _common import SPIDER, fast_config, platform, spider_hurts, state, wait_state

DESCRIPTION = "airborne player struck only within real reach"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=600, lookSeconds=0.4,
                breakContactSeconds=600, escapeDistance=256)
    y = platform(h)
    p = h.spawn("Flyer", x=0, y=y, z=-20)
    h.summon(0.5, y, 0.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting")
    sp = h.spiders(h.snap())[0]
    sx, sy, sz = sp["loc"]
    # 1) far above: 45 blocks over the body - out of reach although it is the target
    t0 = h.mark("held 45 blocks above the giant")
    p.hold(sx, sy + 45, sz + 2)
    h.wait(8)
    far = spider_hurts(h, "Flyer", since=t0)
    h.check(len(far) == 0, "not struck when 45 blocks above (out of reach)", hurts=len(far))
    # 2) at body height beside the body (within 9.5*1.4 of the body centre)
    sp = h.spiders(h.snap())[0]
    sx, sy, sz = sp["loc"]
    t1 = h.mark("held beside the body, 16 blocks up")
    p.hold(sx + 5, sy + 16, sz)
    ok = h.wait_until(lambda hh: spider_hurts(hh, "Flyer", since=t1), 10, desc="airborne strike")
    h.check(ok, "struck when airborne within reach of the body/legs")
    p.release()
