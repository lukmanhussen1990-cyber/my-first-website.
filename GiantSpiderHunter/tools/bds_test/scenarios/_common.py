"""Shared helpers for addon scenarios."""
import math


def dist3(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def hdist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2)


def spider_list(h, probe=None):
    return h.spiders(probe)


def auto_spiders(h, probe=None):
    return [s for s in h.spiders(probe) if "gsh_auto" in (s.get("tags") or [])]


def state(s):
    return (s.get("props") or {}).get("horror:state")


def gsh_log_lines(h):
    """[GSH] lines printed by the addon script."""
    out = []
    for e in list(h.events) + []:
        pass
    path = h.run_dir + "/console.log"
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if "[GSH" in line:
                    out.append(line.strip())
    except OSError:
        pass
    return out


def script_errors(h):
    return [l for l in h.script_errors if "GSH" in l or "giant_spider" in l or "Scripting" in l]


SPIDER = "horror:giant_spider"
PLATFORM_Y = 200


def platform(h, cx=0, cz=0, half=60, y=PLATFORM_Y):
    """Flat stone test arena high in the sky (clear line of sight, deterministic terrain).
    Built in 30x30 tiles (fill volume limit) and kept loaded with a ticking area."""
    h.cmd(f"tickingarea add {cx - half} {y} {cz - half} {cx + half} {y} {cz + half} gsh_arena true")
    for x0 in range(cx - half, cx + half, 30):
        for z0 in range(cz - half, cz + half, 30):
            h.cmd(f"fill {x0} {y} {z0} {min(x0 + 29, cx + half)} {y} {min(z0 + 29, cz + half)} stone")
    h.wait(2)
    return y + 1


def fast_config(h, **kv):
    """Apply addon config overrides from the console (persisted in the world)."""
    for k, v in kv.items():
        h.scriptevent("gsh:config", f"{k} {str(v).lower() if isinstance(v, bool) else v}")
    h.wait(1)


def spiders_now(h):
    return h.spiders(h.snap())


def one_spider(h):
    s = spiders_now(h)
    return s[0] if s else None


def wait_state(h, want, timeout, desc=None):
    want = want if isinstance(want, (list, tuple, set)) else [want]
    return h.wait_until(lambda hh: next((s for s in hh.spiders(hh.snap()) if state(s) in want), None), timeout,
                        desc=desc or f"spider state {want}", poll=0.5)


def spider_hurts(h, name, since=0.0):
    return h.hurts(victim=name, damager_type=SPIDER, since=since)
