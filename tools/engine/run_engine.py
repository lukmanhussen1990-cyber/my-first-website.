#!/usr/bin/env python3
"""In-engine tests of the real add-on on Bedrock Dedicated Server 1.21.0.26 with GameTest.

    python3 tools/engine/run_engine.py --bds /path/to/bds [--only 'torch_*'] [--timeout 2400] [--keep-world]

What it does (docs/ENGINE_TESTS.md has the details):
  1. python3 tools/build.py --no-package (generated lang/sound/texture files), unless --no-build
  2. a shadow server instance in --work (the --bds directory is never modified)
  3. bootstraps a fresh FLAT world, stops, patches level.dat: experiments {gametest: 1b
     ("Beta APIs"), experiments_ever_used: 1b, saved_with_toggled_experiments: 1b}
     -- only this test world; the shipped packs need no experiment
  4. installs as development packs: addon/behavior_pack (instrumented copy: also loads
     @minecraft/server-gametest so simulated players are visible to the add-on's scripts,
     plus the read-only bridge tools/engine/bridge/pastest_bridge.js), addon/resource_pack,
     and the test pack tools/engine/testpack (+ generated GameTest structures and
     house expectations)
  5. phase "main": starts BDS, runs each GameTest with
       execute positioned X -60 Z run gametest run pas:<name>
     and parses PASTEST/PASCHECK lines; then the "pre_reload" tests
  6. stops the server cleanly, restarts it on the same world, runs "after_reload" tests
  7. checks the content log, writes results/{junit.xml,summary.json,server_*.log},
     exit code 0 = no FAIL (PENDING allowed unless --strict), 1 = failures, 2 = harness error

Download BDS 1.21.0.26 (preview, Linux) yourself; doing so accepts the Minecraft EULA:
https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.21.0.26.zip
"""
from __future__ import annotations

import argparse
import fnmatch
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from xml.sax.saxutils import escape, quoteattr

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

import bds as B  # noqa: E402
import house_expect  # noqa: E402
import leveldat  # noqa: E402
import structures  # noqa: E402

LEVEL = "pas_engine"
Y = -60  # first air layer above the grass of a 1.21 FLAT world (grass top at y -61)
GRID = 64
ORIGIN = {"main": (1024, 1024), "pre_reload": (1024, 1792), "after_reload": (1024, 2560)}
PHASES = ("main", "pre_reload", "after_reload")
TESTPACK_DIR = "pas_engine_testpack"
BP_DIR, RP_DIR = "pas_bp", "pas_rp"

LINE_RX = re.compile(r"^\[(\d{4}-\d\d-\d\d [\d:]+)\s+(\w+)\]\s*(?:\[(\w+)\])?\s*(.*)$")
RESULT_RX = re.compile(r"PASTEST\|([^|]+)\|(PASS|FAIL|PENDING|READY|START)\|(.*)$")
REG_RX = re.compile(r"PASREG\|([^|]*)\|([^|]*)\|(\d+)\|([^|]*)\|([01])\|([^|]*)\|(.*)$")
CHECK_RX = re.compile(r"PASCHECK\|([^|]+)\|(ok|FAIL)\|(.*)$")
INFO_RX = re.compile(r"PASINFO\|([^|]+)\|(.*)$")
OUR_MARKERS = ("Parasite Apocalypse", "pas:", "pas_", "pas.", "[pas]", "d49c4c97", "2d23c19d", "3fdec22c",
               "PAS engine tests", "4333e7f9", BP_DIR, RP_DIR, TESTPACK_DIR, "__pastest")
CONTENT_CATEGORIES = ("Scripting", "Json", "Actor", "Blocks", "Item", "Molang", "Texture", "Entity", "Animation",
                      "Packs", "Recipes", "Commands", "Structure", "FeatureRegistry", "Sound", "Particle", "Biome")
SUBSYSTEM_FILES = {"core": "scripts/main.js", "kit": "scripts/lib/kit.js", "torch": "scripts/torchlight/index.js",
                   "house": "scripts/house/index.js", "outbreak": "scripts/outbreak/index.js"}


@dataclass
class Test:
    name: str
    phase: str
    max_ticks: int
    subsystem: str
    bridge: bool
    structure: str
    description: str
    status: str = "NOT_RUN"
    detail: str = ""
    checks: list = field(default_factory=list)
    infos: list = field(default_factory=list)
    engine: list = field(default_factory=list)
    seconds: float = 0.0
    position: tuple = ()


def log(msg: str) -> None:
    print(msg, flush=True)


# ---------------------------------------------------------------- build / install
def run_build(results: Path) -> list[str]:
    notes = []
    cmd = [sys.executable, str(REPO / "tools" / "build.py"), "--no-package"]
    p = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    (results / "build.log").write_text(p.stdout + p.stderr, encoding="utf-8")
    if p.returncode != 0:
        notes.append("tools/build.py --no-package failed validation; retried with --skip-validate (see results/build.log)")
        p = subprocess.run(cmd + ["--skip-validate"], cwd=REPO, capture_output=True, text=True)
        with open(results / "build.log", "a", encoding="utf-8") as fh:
            fh.write("\n--- retry --skip-validate ---\n" + p.stdout + p.stderr)
        if p.returncode != 0:
            raise RuntimeError("tools/build.py failed even with --skip-validate (see results/build.log)")
    return notes


def junk_filter():
    try:
        spec = importlib.util.spec_from_file_location("pas_build", REPO / "tools" / "build.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return lambda p, base: mod.is_junk(p, base)
    except Exception:  # noqa: BLE001 - fall back to a local filter
        bad = (".py", ".pyc", ".md", ".psd", ".xcf", ".kra", ".blend", ".bak", ".tmp", ".swp", "~")
        return lambda p, base: any(part.startswith(".") or part == "__pycache__" for part in p.relative_to(base).parts) \
            or p.name.endswith(bad)


def copy_pack(src: Path, dst: Path) -> None:
    junk = junk_filter()
    for f in sorted(src.rglob("*")):
        if f.is_dir() or junk(f, src):
            continue
        out = dst / f.relative_to(src)
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, out)


def install(inst: Path, source: str, bridge: bool) -> dict:
    """Install BP (instrumented), RP and the test pack; returns pack ids."""
    if source == "dist":
        base = REPO / "dist" / "unpacked"
        bp_src, rp_src = base / "Parasite Apocalypse BP", base / "Parasite Apocalypse RP"
    else:
        bp_src, rp_src = REPO / "addon" / "behavior_pack", REPO / "addon" / "resource_pack"
    for p in (bp_src, rp_src):
        if not (p / "manifest.json").is_file():
            raise RuntimeError(f"pack not found: {p}")
    dev_bp, dev_rp = inst / "development_behavior_packs", inst / "development_resource_packs"
    bp, rp, tp = dev_bp / BP_DIR, dev_rp / RP_DIR, dev_bp / TESTPACK_DIR
    for d in (bp, rp, tp):
        if d.exists():
            shutil.rmtree(d)
    copy_pack(bp_src, bp)
    copy_pack(rp_src, rp)
    # --- instrumentation of the installed BP copy (never of the repository)
    man = json.loads((bp / "manifest.json").read_text(encoding="utf-8"))
    script = next(m for m in man["modules"] if m.get("type") == "script")
    entry = script["entry"]
    rel_entry = "./" + str(Path(entry).relative_to("scripts")).replace(os.sep, "/")
    lines = ["// engine-harness instrumentation (installed test copy only; see tools/engine/run_engine.py)",
             "import \"@minecraft/server-gametest\"; // binds SimulatedPlayer in this script context",
             f"import \"{rel_entry}\";"]
    if bridge:
        shutil.copy2(HERE / "bridge" / "pastest_bridge.js", bp / "scripts" / "__pastest_bridge.js")
        lines.append("import \"./__pastest_bridge.js\";")
    (bp / "scripts" / "__pastest_entry.js").write_text("\n".join(lines) + "\n", encoding="utf-8")
    script["entry"] = "scripts/__pastest_entry.js"
    deps = [d for d in man.get("dependencies", []) if d.get("module_name") != "@minecraft/server-gametest"]
    deps.append({"module_name": "@minecraft/server-gametest", "version": "1.0.0-beta"})
    man["dependencies"] = deps
    (bp / "manifest.json").write_text(json.dumps(man, indent=2), encoding="utf-8")
    # --- test pack
    shutil.copytree(HERE / "testpack", tp)
    structures.write_all(tp / "structures")
    hx = house_expect.build(bp_src / "structures" / "pas" / "luxury_base.mcstructure",
                            bp_src / "scripts" / "house" / "blueprint_meta.js")
    house_expect.write_js(hx, tp / "scripts" / "house_expect.js")
    tman = json.loads((tp / "manifest.json").read_text(encoding="utf-8"))
    for d in tman["dependencies"]:
        if d.get("uuid") == man["header"]["uuid"]:
            d["version"] = man["header"]["version"]
    (tp / "manifest.json").write_text(json.dumps(tman, indent=2), encoding="utf-8")
    rman = json.loads((rp / "manifest.json").read_text(encoding="utf-8"))
    return {
        "bp": (man["header"]["uuid"], man["header"]["version"]),
        "rp": (rman["header"]["uuid"], rman["header"]["version"]),
        "tp": (tman["header"]["uuid"], tman["header"]["version"]),
    }


def attach_packs(world_dir: Path, ids: dict) -> None:
    (world_dir / "world_behavior_packs.json").write_text(json.dumps([
        {"pack_id": ids["bp"][0], "version": ids["bp"][1]},
        {"pack_id": ids["tp"][0], "version": ids["tp"][1]}], indent=1), encoding="utf-8")
    (world_dir / "world_resource_packs.json").write_text(json.dumps([
        {"pack_id": ids["rp"][0], "version": ids["rp"][1]}], indent=1), encoding="utf-8")


def subsystem_placeholders(source: str) -> dict:
    base = REPO / "addon" / "behavior_pack" if source != "dist" else REPO / "dist" / "unpacked" / "Parasite Apocalypse BP"
    out = {}
    for sub, rel in SUBSYSTEM_FILES.items():
        f = base / rel
        out[sub] = (not f.is_file()) or "PLACEHOLDER" in f.read_text(encoding="utf-8", errors="replace")
    return out


def list_static_tests() -> list[str]:
    names = []
    for f in sorted((HERE / "testpack" / "scripts").glob("tests_*.js")):
        src = f.read_text(encoding="utf-8")
        names += re.findall(r"name:\s*\"([a-z0-9_]+)\"", src)
        if "houseTest(" in src:
            names += [f"house_{d}" for d in ("north", "east", "south", "west")]
    return names


# ---------------------------------------------------------------- server phases
def server_props(port: int, port6: int, threads: int) -> dict:
    return {
        "level-name": LEVEL, "level-type": "FLAT", "level-seed": "pasengine", "gamemode": "survival",
        "difficulty": "normal", "allow-cheats": "true", "online-mode": "false", "server-port": str(port),
        "server-portv6": str(port6), "enable-lan-visibility": "false", "content-log-file-enabled": "true",
        "max-threads": str(threads), "tick-distance": "4", "view-distance": "10", "player-idle-timeout": "0",
        "default-player-permission-level": "operator",
    }


def echo_filter(verbose: bool):
    def echo(line: str) -> None:
        if verbose or re.search(r"PASTEST\||PASCHECK\|[^|]+\|FAIL|ERROR|Exception|Beta APIs", line):
            log("  | " + line)
    return echo


def start_and_wait(srv: B.Server, what: str, need_ready: bool = True) -> int:
    srv.start()
    if srv.wait_for(r"Server started\.", 120) is None:
        raise RuntimeError(f"{what}: server did not start (see results/server_*.log)")
    if need_ready:
        r = srv.wait_for(r"PASTEST_READY\|", 90)
        if r is None:
            beta = [l for l in srv.lines if "Beta APIs" in l or "gametest" in l.lower()]
            raise RuntimeError(f"{what}: test pack never became ready (gametest import failed?) {beta[:5]}")
        return r[0]
    return srv.mark()


def configure_world(srv: B.Server) -> None:
    for c in ("gamerule domobspawning false", "gamerule dodaylightcycle false", "gamerule doweathercycle false",
              "time set noon", "weather clear", "gamerule keepinventory false", "gamerule showdeathmessages false"):
        srv.send(c)
    time.sleep(1.0)


def parse_registry(lines: list[str]) -> dict[str, Test]:
    reg: dict[str, Test] = {}
    for l in lines:
        m = REG_RX.search(l)
        if m:
            reg[m.group(1)] = Test(m.group(1), m.group(2), int(m.group(3)), m.group(4), m.group(5) == "1",
                                   m.group(6), m.group(7))
    return reg


def run_test(srv: B.Server, t: Test, pos: tuple, deadline: float, wait_status=("PASS", "FAIL", "PENDING", "READY")) -> None:
    t.position = pos
    mark = srv.mark()
    started = time.time()
    srv.send(f"execute positioned {pos[0]} {Y} {pos[1]} run gametest run pas:{t.name}")
    # 20 ticks per second nominal; allow for slow ticking under load
    budget = min(t.max_ticks / 20 * 1.6 + 60, max(5.0, deadline - time.time()))
    rx = re.compile(r"PASTEST\|" + re.escape(t.name) + r"\|(" + "|".join(wait_status) + r")\|(.*)$")
    r = srv.wait_for(rx, budget, mark)
    end = srv.mark()
    t.seconds = round(time.time() - started, 1)
    window = srv.lines[mark:end]
    for l in window:
        m = CHECK_RX.search(l)
        if m and m.group(1) == t.name:
            t.checks.append((m.group(2), m.group(3)))
        m = INFO_RX.search(l)
        if m and m.group(1) == t.name:
            t.infos.append(m.group(2))
    t.engine = [l for l in window if is_problem(l)]
    if r is None:
        started_line = any(re.search(r"PASTEST\|" + re.escape(t.name) + r"\|START", l) for l in window)
        other = [l for l in window if not re.search(r"PAS(TEST|CHECK|INFO)\|", l)][-6:]
        t.status = "FAIL"
        t.detail = (f"no result within {budget:.0f}s" if started_line else "test never started") + \
                   (f"; server: {' / '.join(other)}" if other else "") + ("" if srv.alive() else "; SERVER EXITED")
        srv.send("gametest stopall")
        time.sleep(2)
        return
    t.status, t.detail = r[1].group(1), r[1].group(2)


# ---------------------------------------------------------------- content log
def group_lines(lines: list[str]) -> list[tuple[int, str]]:
    """Join continuation lines (stack traces) to their log line; returns (index, text)."""
    out: list[tuple[int, str]] = []
    for i, l in enumerate(lines):
        if LINE_RX.match(l) or not out:
            out.append((i, l))
        elif l.strip():
            out[-1] = (out[-1][0], out[-1][1] + " ⏎ " + l.strip())
    return out


def is_problem(line: str) -> bool:
    m = LINE_RX.match(line)
    if not m:
        return False
    level, cat, text = m.group(2), m.group(3), m.group(4)
    if re.match(r"PAS(TEST|CHECK|INFO|REG|BRIDGE)|PASTEST_READY", text or ""):
        return False
    if level == "ERROR":
        return True
    return level == "WARN" and (cat in CONTENT_CATEGORIES) and ("[pas]" in text or cat != "Scripting")


def classify_log(lines: list[str]) -> dict:
    errors, warnings, foreign, addon_runtime = [], [], [], []
    for _, l in group_lines(lines):
        m = LINE_RX.match(l)
        if not m:
            continue
        level, cat, text = m.group(2), m.group(3) or "", m.group(4)
        if re.match(r"PAS(TEST|CHECK|INFO|REG)|PASTEST_READY", text):
            continue
        if text.startswith("PASBRIDGE|") and "failed" not in text:
            continue
        ours = any(k in text for k in OUR_MARKERS)
        if "[pas]" in text and " failed" in text:
            addon_runtime.append(l)
        elif level == "ERROR" and (cat in CONTENT_CATEGORIES or not cat):
            (errors if ours else foreign).append(l)
        elif level == "WARN" and cat in CONTENT_CATEGORIES and cat != "Scripting":
            (warnings if ours else foreign).append(l)
        elif level == "WARN" and cat == "Scripting" and ours and not text.startswith("PASBRIDGE|loaded"):
            warnings.append(l)
    return {"errors": errors, "warnings": warnings, "foreign": foreign, "addon_runtime": addon_runtime}


# ---------------------------------------------------------------- reports
def write_junit(path: Path, tests: list[Test], pseudo: list[Test]) -> None:
    allt = pseudo + tests
    fails = sum(t.status == "FAIL" for t in allt)
    skipped = sum(t.status in ("PENDING", "NOT_RUN") for t in allt)
    total = sum(t.seconds for t in allt)
    out = [f'<?xml version="1.0" encoding="UTF-8"?>',
           f'<testsuite name="pas-engine" tests="{len(allt)}" failures="{fails}" errors="0" skipped="{skipped}" time="{total:.1f}">']
    for t in allt:
        out.append(f'  <testcase classname={quoteattr("pas." + t.phase)} name={quoteattr(t.name)} time="{t.seconds:.1f}">')
        body = "\n".join([f"[{s}] {m}" for s, m in t.checks] + [f"info: {i}" for i in t.infos] +
                         [f"engine: {e}" for e in t.engine])
        if t.status == "FAIL":
            out.append(f'    <failure message={quoteattr(t.detail[:500])}>{escape(body)}</failure>')
        elif t.status in ("PENDING", "NOT_RUN"):
            out.append(f'    <skipped message={quoteattr((t.status + ": " + t.detail)[:500])}/>')
        if body:
            out.append(f"    <system-out>{escape(body)}</system-out>")
        out.append("  </testcase>")
    out.append("</testsuite>")
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bds", default=os.environ.get("PAS_BDS_DIR"), help="extracted BDS 1.21.0.26 (or $PAS_BDS_DIR)")
    ap.add_argument("--only", action="append", default=[], help="test-name glob(s), comma separated or repeated")
    ap.add_argument("--timeout", type=float, default=2400, help="overall wall-clock budget in seconds")
    ap.add_argument("--keep-world", action="store_true", help="keep the server instance + world after the run")
    ap.add_argument("--work", default=os.environ.get("PAS_ENGINE_WORK", str(Path(tempfile.gettempdir()) / "pas_engine")),
                    help="work directory (instance/ and results/)")
    ap.add_argument("--source", choices=("addon", "dist"), default="addon", help="install from addon/ or dist/unpacked/")
    ap.add_argument("--no-build", action="store_true", help="do not run tools/build.py first")
    ap.add_argument("--no-bridge", action="store_true", help="do not inject the test bridge into the installed BP")
    ap.add_argument("--no-reload", action="store_true", help="skip the save/reload phase")
    ap.add_argument("--strict", action="store_true", help="PENDING tests count as failures")
    ap.add_argument("--threads", type=int, default=2, help="server max-threads (keep CPU use low)")
    ap.add_argument("--verbose", action="store_true", help="echo every server line")
    ap.add_argument("--list", action="store_true", help="list the tests and exit")
    args = ap.parse_args()

    if args.list:
        for n in list_static_tests():
            print(n)
        return 0
    if not args.bds:
        log("SKIP: no BDS directory (use --bds or PAS_BDS_DIR); see docs/ENGINE_TESTS.md")
        return 0
    bds = Path(args.bds).resolve()
    why = B.check_bds_dir(bds)
    if why:
        log(f"ERROR: {why}")
        return 2
    B.install_signal_handlers()
    t_start = time.time()
    deadline = t_start + args.timeout
    work = Path(args.work).resolve()
    inst, results = work / "instance", work / "results"
    if results.exists():
        shutil.rmtree(results)
    results.mkdir(parents=True)
    globs = [g.strip() for o in args.only for g in o.split(",") if g.strip()]
    notes: list[str] = []
    pseudo: list[Test] = []
    tests: list[Test] = []
    srv: B.Server | None = None
    harness_error = None
    all_lines: list[str] = []
    try:
        if not args.no_build:
            log("== build: tools/build.py --no-package")
            notes += run_build(results)
        placeholders = subsystem_placeholders(args.source)
        log(f"== instance: {inst} (shadow of {bds})")
        B.make_instance(bds, inst)
        port = B.free_udp_port()
        port6 = B.free_udp_port({port})
        B.write_properties(inst, server_props(port, port6, args.threads))
        shim = None if B.ipv6_ok() else B.build_shim(work)
        if shim:
            notes.append("no IPv6 in this kernel: BDS runs with the fake6 LD_PRELOAD shim")
        echo = echo_filter(args.verbose)

        # ---- bootstrap the world, then enable the Beta APIs experiment in level.dat
        log("== bootstrap world")
        srv = B.Server(inst, bds, shim, echo=None, log_file=results / "server_bootstrap.log")
        start_and_wait(srv, "bootstrap", need_ready=False)
        how = srv.stop()
        all_lines += srv.lines
        world_dir = inst / "worlds" / LEVEL
        ld = world_dir / "level.dat"
        if how != "clean" or not ld.is_file():
            raise RuntimeError(f"bootstrap world not created cleanly ({how}, level.dat exists: {ld.is_file()})")
        before = leveldat.read_experiments(ld)
        after = leveldat.enable_experiments(ld, extra_bytes={"cheatsEnabled": 1})
        log(f"   level.dat experiments: {before} -> {after}")
        exp_test = Test("beta_apis_experiment", "harness", 0, "harness", False, "", "Beta APIs enabled only in the test world")
        pseudo.append(exp_test)

        ids = install(inst, args.source, bridge=not args.no_bridge)
        attach_packs(world_dir, ids)

        # ---- phase main
        log("== phase main: start server")
        srv = B.Server(inst, bds, shim, echo=echo, log_file=results / "server_main.log")
        ready = start_and_wait(srv, "main")
        configure_world(srv)
        reg = parse_registry(srv.lines[:ready + 1])
        beta_err = [l for l in srv.lines if "Beta APIs experiment is not enabled" in l]
        promoted = [l for l in srv.lines if "requested by [@minecraft/server-gametest" in l]
        exp_test.status = "PASS" if reg and not beta_err and leveldat.read_experiments(ld).get("gametest") == 1 else "FAIL"
        exp_test.detail = f"level.dat experiments={leveldat.read_experiments(ld)}; test pack registered {len(reg)} GameTests"
        exp_test.infos += [l for l in promoted][:3] + beta_err[:3]
        if not args.no_bridge and not any("PASBRIDGE|loaded" in l for l in srv.lines):
            notes.append("bridge did not load in the add-on context (check the add-on's script errors)")
        tests = list(reg.values())
        sel = [t for t in tests if not globs or any(fnmatch.fnmatch(t.name, g) for g in globs)]
        if any(t.phase != "main" for t in sel):  # the reload pair always runs together
            sel += [t for t in tests if t.phase != "main" and t not in sel]
        if args.no_reload:
            sel = [t for t in sel if t.phase == "main"]
        for t in tests:
            if t not in sel:
                t.status, t.detail = "NOT_RUN", "not selected"
        order = {p: [t for t in sel if t.phase == p] for p in PHASES}
        log(f"   registered {len(tests)} tests, running {len(sel)}")

        def run_list(phase: str):
            x0, z0 = ORIGIN[phase]
            for i, t in enumerate(order[phase]):
                if time.time() > deadline:
                    t.status, t.detail = "FAIL", "overall --timeout reached before this test"
                    continue
                if not srv.alive():
                    t.status, t.detail = "FAIL", "server not running"
                    continue
                pos = (x0 + (i % 8) * GRID, z0 + (i // 8) * GRID)
                run_test(srv, t, pos, deadline)
                log(f"-- {t.name}: {t.status} ({t.seconds}s) {t.detail[:300]}")

        run_list("main")
        run_list("pre_reload")
        reload_ready = all(t.status == "READY" for t in order["pre_reload"])
        log("== stop (clean)")
        how = srv.stop()
        all_lines += srv.lines
        stop_test = Test("clean_stop_main", "harness", 0, "harness", False, "", "server stops cleanly with 'stop'")
        stop_test.status = "PASS" if how == "clean" else "FAIL"
        stop_test.detail = f"server ended: {how}"
        pseudo.append(stop_test)
        for t in order["pre_reload"]:
            if t.status == "READY":
                t.status = "PASS"
        # ---- phase after_reload
        if order["after_reload"]:
            if not reload_ready:
                for t in order["after_reload"]:
                    t.status, t.detail = "FAIL", "pre-reload setup did not reach READY"
            else:
                log("== phase after_reload: restart on the same world")
                srv = B.Server(inst, bds, shim, echo=echo, log_file=results / "server_after_reload.log")
                start_and_wait(srv, "after_reload")
                configure_world(srv)
                run_list("after_reload")
                how = srv.stop()
                all_lines += srv.lines
                st2 = Test("clean_stop_after_reload", "harness", 0, "harness", False, "", "")
                st2.status, st2.detail = ("PASS" if how == "clean" else "FAIL"), f"server ended: {how}"
                pseudo.append(st2)
        exp_after = leveldat.read_experiments(ld)
        exp_test.infos.append(f"level.dat experiments after the run: {exp_after}")
    except Exception as e:  # noqa: BLE001
        harness_error = f"{type(e).__name__}: {e}"
        log(f"HARNESS ERROR: {harness_error}")
    finally:
        if srv is not None and srv.alive():
            srv.kill()
            all_lines += srv.lines
        for f in inst.glob("ContentLog*.txt") if inst.exists() else []:
            shutil.copy2(f, results / f.name)
        if not args.keep_world and inst.exists():
            shutil.rmtree(inst, ignore_errors=True)

    # ---- content log
    cl = classify_log(all_lines)
    log_test = Test("content_log", "harness", 0, "harness", False, "", "no content-log errors mentioning our packs")
    log_test.status = "FAIL" if cl["errors"] else "PASS"
    log_test.detail = f"{len(cl['errors'])} errors, {len(cl['warnings'])} warnings mentioning our packs"
    log_test.engine = cl["errors"] + cl["warnings"]
    rt_test = Test("addon_runtime_errors", "harness", 0, "harness", False, "", "no '[pas] ... failed' errors logged by the add-on")
    rt_test.status = "FAIL" if cl["addon_runtime"] else "PASS"
    rt_test.detail = f"{len(cl['addon_runtime'])} caught exceptions logged by the add-on"
    rt_test.engine = cl["addon_runtime"]
    pseudo += [log_test, rt_test]

    # ---- PENDING for subsystems that are still placeholders
    placeholders = subsystem_placeholders(args.source)
    for t in tests:
        if t.status == "FAIL" and placeholders.get(t.subsystem):
            t.status, t.detail = "PENDING", f"pending subsystem '{t.subsystem}' (placeholder): {t.detail}"

    write_junit(results / "junit.xml", tests, pseudo)
    summary = {
        "harness_error": harness_error, "notes": notes, "seconds": round(time.time() - t_start, 1),
        "tests": [t.__dict__ for t in pseudo + tests], "content_log": cl,
    }
    (results / "summary.json").write_text(json.dumps(summary, indent=1, default=str), encoding="utf-8")

    log("\n================ engine test summary ================")
    for t in pseudo + tests:
        log(f"{t.status:8} {t.phase:12} {t.name:28} {t.seconds:6.1f}s  {t.detail[:160]}")
        if t.status == "FAIL":
            for s, m in t.checks:
                if s == "FAIL":
                    log(f"           check FAIL: {m[:300]}")
            for e in t.engine[:6]:
                log(f"           engine: {e[:300]}")
    for n in notes:
        log(f"note: {n}")
    if cl["warnings"]:
        log(f"content-log warnings mentioning our packs: {len(cl['warnings'])} (see results/summary.json)")
    log(f"results: {results}" + (f"   world kept: {inst}" if args.keep_world else ""))
    counts = {s: sum(t.status == s for t in pseudo + tests) for s in ("PASS", "FAIL", "PENDING", "NOT_RUN")}
    log(f"{counts['PASS']} passed, {counts['FAIL']} failed, {counts['PENDING']} pending, {counts['NOT_RUN']} not run")
    if harness_error:
        return 2
    if counts["FAIL"] or (args.strict and counts["PENDING"]):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
