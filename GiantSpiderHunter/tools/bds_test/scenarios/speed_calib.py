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
    for v in (0.05, 0.07, 0.09, 0.11, 0.14, 0.3):
        speeds = []
        for rep in range(2):
            h.call("entityTp", check=False, target={"type": "horror:giant_spider"}, x=0.5, y=y, z=-55.5)
            h.call("setMovement", check=False, target={"type": "horror:giant_spider"}, value=v)
            h.wait(0.8)
            vels = []
            for i in range(10):
                sp = h.spiders(h.snap())
                if sp and sp[0].get("vel") and abs(sp[0]["loc"][2] - 12.5) > 15:
                    vx, vy, vz = sp[0]["vel"]
                    vels.append((vx * vx + vz * vz) ** 0.5 * 20)
                h.wait(0.2)
            if vels:
                speeds.append(round(sum(vels) / len(vels), 2))
        results.append((v, round(v * 3.4, 3), speeds))
        h.note(f"movement {v} (effective {v * 3.4:.3f}): {speeds} blocks/s (velocity-based)")
    h.check(True, f"speeds {results}")
