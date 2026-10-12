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
