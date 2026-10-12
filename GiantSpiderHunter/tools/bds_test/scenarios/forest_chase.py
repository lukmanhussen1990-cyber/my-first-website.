"""Real terrain: the giant pursues a player through forest and hills (navigation around trees)."""
import math
from _common import SPIDER, fast_config, hdist, spider_hurts, state, wait_state

DESCRIPTION = "pursuit through a real forest / uneven ground"


def run(h):
    fast_config(h, autoSpawn=False, growthDurationSeconds=2, stalkTimeoutSeconds=600, breakContactSeconds=600,
                escapeDistance=200, strikeDamage=0, biteDamage=0)
    x, z = h.forest()
    p = h.spawn("Prey", x=x, z=z)
    h.wait(2)
    pl = h.player("Prey", h.snap())["loc"]
    h.summon(round(pl[0]) + 0.5, round(pl[1]) + 2, round(pl[2]) - 18.5, event="horror:spawn_giant")
    h.check(wait_state(h, "hunting", 15), "giant hunting in the forest")
    t0 = h.mark("prey runs through the forest")
    # run to points 70 blocks away (sim player path-finds through the trees), several legs
    path = [(pl[0] + 40, pl[2] + 55), (pl[0] - 30, pl[2] + 70), (pl[0] - 60, pl[2] + 10)]
    samples = []
    p.sprint(True)
    for tx, tz in path:
        h.call("moveTo", check=False, name="Prey", x=tx, y=pl[1], z=tz, speed=1.0)
        for i in range(16):
            h.wait(0.5)
            if i % 2 == 0:
                h.call("jump", check=False, name="Prey")
            snap = h.snap()
            a = h.player("Prey", snap)
            sp = h.spiders(snap)
            if a and sp:
                samples.append((h.now(), a["loc"], sp[0]["loc"], state(sp[0])))
    p.stop()
    if len(samples) > 8:
        moved = sum(hdist(samples[i][2], samples[i + 1][2]) for i in range(len(samples) - 1))
        dur = samples[-1][0] - samples[0][0]
        prey_moved = sum(hdist(samples[i][1], samples[i + 1][1]) for i in range(len(samples) - 1))
        gaps = [hdist(s[1], s[2]) for s in samples]
        dys = [s[2][1] - samples[0][2][1] for s in samples]
        h.note(f"spider path {moved:.1f} blocks in {dur:.1f}s ({moved / dur:.2f} b/s); prey {prey_moved:.1f}; "
               f"gap min {min(gaps):.1f} max {max(gaps):.1f} last {gaps[-1]:.1f}; spider height change {min(dys):.1f}..{max(dys):.1f}")
        h.check(prey_moved > 15, "prey actually ran", prey=round(prey_moved, 1))
        h.check(moved >= 0.6 * prey_moved, "giant keeps up with the prey through the forest",
                spider=round(moved, 1), prey=round(prey_moved, 1))
        stuck = 0
        for i in range(6, len(samples)):
            if hdist(samples[i - 6][2], samples[i][2]) < 1.0 and hdist(samples[i][1], samples[i][2]) > 6:
                stuck += 1
        h.check(stuck <= 4, "giant does not get stuck on trees for long", stuck_windows=stuck)
        h.check(all(s[3] == "hunting" for s in samples), "keeps hunting the whole time")
    else:
        h.check(False, "enough samples", n=len(samples))
