"""Calibration: real chase speed (blocks/s) of the hunting giant for several movement values."""
from _common import fast_config, hdist, platform, state, wait_state

DESCRIPTION = "measure giant chase speed vs minecraft:movement"
NEEDS_ADDON = True


def run(h):
    fast_config(h, autoSpawn=False, strikeDamage=0, biteDamage=0, breakContactSeconds=600, escapeDistance=250,
                catchUpMultiplier=1)
    y = platform(h, half=60)
    p = h.spawn("Bait", x=0, y=y, z=12)
    p.hold(0.5, y, 12.5)
    h.summon(0.5, y, -50.5, event="horror:spawn_giant")
    h.require(wait_state(h, "hunting", 15), "giant hunting")
    results = []
    for v in (None, 0.45, 0.6, 0.8, 1.0):
        h.call("entityTp", check=False, target={"type": "horror:giant_spider"}, x=0.5, y=y, z=-48.5)
        if v is not None:
            r = h.call("setMovement", check=False, target={"type": "horror:giant_spider"}, value=v)
            h.note(f"set movement {v}: {r}")
        h.wait(1.5)
        a = h.spiders(h.snap())[0]["loc"]
        t0 = h.now()
        h.wait(3.0)
        b = h.spiders(h.snap())[0]["loc"]
        t1 = h.now()
        sp = hdist(a, b) / (t1 - t0)
        results.append((v, round(sp, 2)))
        h.note(f"movement {v if v is not None else 'default'}: {sp:.2f} blocks/s")
    h.check(True, f"speeds {results}")
