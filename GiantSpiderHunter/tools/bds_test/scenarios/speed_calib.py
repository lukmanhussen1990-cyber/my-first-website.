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
    for v in (None, 0.34, 0.38, 0.42, 0.5, None):
        speeds = []
        for rep in range(2):
            h.call("entityTp", check=False, target={"type": "horror:giant_spider"}, x=0.5, y=y, z=-48.5)
            if v is not None:
                h.call("setMovement", check=False, target={"type": "horror:giant_spider"}, value=v)
            else:
                h.call("setMovement", check=False, target={"type": "horror:giant_spider"}, value=0.3)
            h.wait(1.0)
            pts = []
            for i in range(12):
                snap = h.snap()
                sp = h.spiders(snap)
                if sp:
                    pts.append((h.now(), sp[0]["loc"]))
                h.wait(0.25)
            far = [(t, l) for t, l in pts if abs(l[2] - 12.5) > 12]
            if len(far) >= 3:
                sp_ = hdist(far[0][1], far[-1][1]) / max(0.1, far[-1][0] - far[0][0])
                speeds.append(round(sp_, 2))
        results.append((v if v is not None else 0.3, speeds))
        h.note(f"movement {v if v is not None else 0.3} (x melee 3.4): {speeds} blocks/s")
    h.check(True, f"speeds {results}")
