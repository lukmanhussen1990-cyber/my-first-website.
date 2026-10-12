#!/usr/bin/env python3
"""Giant Spider Hunter - runtime test harness on the real Bedrock Dedicated Server 1.21.0.26.

Library + CLI. See tools/bds_test/README.md for the full guide.

    python3 tools/bds_test/bds.py list
    python3 tools/bds_test/bds.py run smoke                 # harness self-test (no addon needed)
    python3 tools/bds_test/bds.py run auto_spawn look_trigger -j 2
    python3 tools/bds_test/bds.py run all                   # every scenario
    python3 tools/bds_test/bds.py serve --name dev          # interactive console

Every run lives in  $GSH_RUNS_DIR/<name>/  (default /tmp/claude-0/work/harness/runs/<name>/):
    server/              fresh BDS copy (world in server/worlds/gsh_test/)
    console.log          raw server stdout (+ '>> ' lines for everything sent to stdin)
    timeline.jsonl       every GSHT line (probes, events, acks) + harness marks/checks
    content_log.txt      the server's ContentLog*.txt files concatenated
    result.json          scenario verdict, checks, errors
"""
import argparse
import importlib.util
import json
import os
import queue
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import traceback
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))  # GiantSpiderHunter/
sys.path.insert(0, HERE)
import nbt_le  # noqa: E402

PRISTINE = os.environ.get("GSH_BDS_DIR", "/tmp/claude-0/bds/server")
RUNS_DIR = os.environ.get("GSH_RUNS_DIR", "/tmp/claude-0/work/harness/runs")
CACHE_DIR = os.environ.get("GSH_CACHE_DIR", os.path.join(os.path.dirname(RUNS_DIR), "cache"))
TEST_PACK = os.path.join(HERE, "test_pack")
SCENARIO_DIR = os.path.join(HERE, "scenarios")
ADDON_BP = os.path.join(ROOT, "packs", "GiantSpiderHunter_BP")
ADDON_RP = os.path.join(ROOT, "packs", "GiantSpiderHunter_RP")
SHIM_SRC = os.path.join(HERE, "ipv6shim.c")
LEVEL_NAME = "gsh_test"
DEFAULT_SEED = 0  # replaced below; see README "World / seed"
SPIDER = "horror:giant_spider"
GAMETEST_MODULE = {"module_name": "@minecraft/server-gametest", "version": "1.0.0-beta"}
WRAPPER_NAME = "__gsh_harness_entry.js"

# Fixed seed whose world spawn sits in/next to a forest (verified with findClosestBiome on
# BDS 1.21.0.26; see README). Override with --seed or Harness(seed=...).
DEFAULT_SEED = 12345


class HarnessError(Exception):
    pass


def log(msg):
    sys.stderr.write(f"[bds] {msg}\n")
    sys.stderr.flush()


# ------------------------------------------------------------------------------- helpers
def ipv6_available():
    try:
        s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        s.close()
        return True
    except OSError:
        return False


def shim_path():
    """Compile ipv6shim.so once (cached); needed only when the kernel has no IPv6."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    so = os.path.join(CACHE_DIR, "ipv6shim.so")
    if not os.path.exists(so) or os.path.getmtime(so) < os.path.getmtime(SHIM_SRC):
        tmp = so + f".{os.getpid()}.tmp"
        subprocess.run(["gcc", "-O2", "-shared", "-fPIC", "-o", tmp, SHIM_SRC, "-ldl"], check=True)
        os.replace(tmp, so)
    return so


def udp_port_free(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.bind(("0.0.0.0", port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def pick_port(name):
    base = 30000 + (zlib.crc32(name.encode()) % 2000) * 4
    for i in range(400):
        p = 30000 + ((base - 30000 + i * 4) % 8000)
        if udp_port_free(p) and udp_port_free(p + 1):
            return p
    raise HarnessError("no free UDP port pair found")


def read_json(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)
        fh.write("\n")


def set_properties(path, values):
    """Rewrite server.properties keeping comments; unknown keys are appended."""
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().splitlines()
    done = set()
    out = []
    for line in lines:
        m = re.match(r"^([A-Za-z0-9\-_.]+)=(.*)$", line)
        if m and m.group(1) in values:
            out.append(f"{m.group(1)}={values[m.group(1)]}")
            done.add(m.group(1))
        else:
            out.append(line)
    for k, v in values.items():
        if k not in done:
            out.append(f"{k}={v}")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")
    os.replace(tmp, path)  # never write through a link into the pristine copy


# ------------------------------------------------------------------------------- server
class BDSServer:
    """One Bedrock Dedicated Server instance in RUNS_DIR/<name>/server."""

    READY_RE = re.compile(r"\] Server started\.")
    GSHT_RE = re.compile(r"\[Scripting\] GSHT (\{.*\})\s*$")

    def __init__(self, name, run_dir, seed=DEFAULT_SEED, port=None, gamemode="survival",
                 difficulty="normal", tick_distance=4, view_distance=10, properties=None,
                 on_line=None):
        self.name = name
        self.run_dir = run_dir
        self.dir = os.path.join(run_dir, "server")
        self.world = os.path.join(self.dir, "worlds", LEVEL_NAME)
        self.seed = seed
        self.port = port
        self.gamemode = gamemode
        self.difficulty = difficulty
        self.tick_distance = tick_distance
        self.view_distance = view_distance
        self.extra_props = dict(properties or {})
        self.on_line = on_line
        self.proc = None
        self.reader = None
        self.lines = queue.Queue()
        self.started = threading.Event()
        self.exited = threading.Event()
        self.console = None
        self.boots = 0
        self.lock = threading.Lock()

    # ---- files
    def create(self):
        """Fresh copy of the pristine server (debug symbols skipped)."""
        if os.path.exists(self.run_dir):
            shutil.rmtree(self.run_dir)
        os.makedirs(self.dir)
        for entry in sorted(os.listdir(PRISTINE)):
            if entry == "bedrock_server_symbols.debug":
                continue
            src = os.path.join(PRISTINE, entry)
            dst = os.path.join(self.dir, entry)
            if os.path.isdir(src):
                shutil.copytree(src, dst, symlinks=True)
            else:
                shutil.copy2(src, dst)
        if self.port is None:
            self.port = pick_port(self.name)
        self.write_properties()

    def write_properties(self):
        props = {
            "server-name": f"GSH test {self.name}",
            "gamemode": self.gamemode,
            "force-gamemode": "false",
            "difficulty": self.difficulty,
            "allow-cheats": "true",
            "max-players": "20",
            "online-mode": "false",
            "allow-list": "false",
            "server-port": str(self.port),
            "server-portv6": str(self.port + 1),
            "enable-lan-visibility": "false",
            "view-distance": str(self.view_distance),
            "tick-distance": str(self.tick_distance),
            "player-idle-timeout": "0",
            "level-name": LEVEL_NAME,
            "level-seed": str(self.seed),
            "default-player-permission-level": "operator",
            "content-log-file-enabled": "true",
            "texturepack-required": "false",
        }
        props.update({k: str(v) for k, v in self.extra_props.items()})
        set_properties(os.path.join(self.dir, "server.properties"), props)

    def level_dat(self):
        return os.path.join(self.world, "level.dat")

    # ---- process
    def _env(self):
        env = dict(os.environ)
        env["LD_LIBRARY_PATH"] = self.dir
        if not ipv6_available():
            env["LD_PRELOAD"] = shim_path()
        return env

    def start(self, timeout=120):
        if self.proc and self.proc.poll() is None:
            raise HarnessError("server already running")
        self.started.clear()
        self.exited.clear()
        self.boots += 1
        if self.console is None:
            self.console = open(os.path.join(self.run_dir, "console.log"), "a", encoding="utf-8", errors="replace")
        self.console.write(f">> ---- boot #{self.boots} {time.strftime('%H:%M:%S')} ----\n")
        self.proc = subprocess.Popen(
            [os.path.join(self.dir, "bedrock_server")],
            cwd=self.dir, env=self._env(), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, bufsize=1, text=True, encoding="utf-8", errors="replace",
        )
        self.reader = threading.Thread(target=self._read, args=(self.proc,), daemon=True)
        self.reader.start()
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.started.wait(0.2):
                return
            if self.exited.is_set():
                raise HarnessError(f"bedrock_server exited during startup (code {self.proc.poll()}); see {self.console.name}")
        self.kill()
        raise HarnessError("timeout waiting for 'Server started.'")

    def _read(self, proc):
        for line in proc.stdout:
            line = line.rstrip("\n")
            with self.lock:
                self.console.write(line + "\n")
                self.console.flush()
            if not self.started.is_set() and self.READY_RE.search(line):
                self.started.set()
            if self.on_line:
                try:
                    self.on_line(line)
                except Exception:  # never kill the reader
                    traceback.print_exc()
        proc.wait()
        with self.lock:
            self.console.write(f">> ---- exit code {proc.returncode} ----\n")
            self.console.flush()
        self.exited.set()

    def running(self):
        return self.proc is not None and self.proc.poll() is None

    def send(self, command):
        if not self.running():
            raise HarnessError(f"server not running (cannot send {command!r})")
        with self.lock:
            self.console.write(">> " + command + "\n")
        self.proc.stdin.write(command + "\n")
        self.proc.stdin.flush()

    def stop(self, timeout=60):
        if not self.running():
            return
        try:
            self.send("stop")
        except (HarnessError, BrokenPipeError, OSError):
            pass
        try:
            self.proc.wait(timeout)
        except subprocess.TimeoutExpired:
            log("server did not stop in time - killing")
            self.kill()
        self.exited.wait(10)

    def kill(self):
        if self.proc and self.proc.poll() is None:
            self.proc.kill()
            self.proc.wait(10)

    def content_log_files(self):
        return sorted(f for f in os.listdir(self.dir) if f.startswith("ContentLog") and f.endswith(".txt"))

    def collect_content_log(self):
        out = os.path.join(self.run_dir, "content_log.txt")
        with open(out, "w", encoding="utf-8", errors="replace") as fh:
            for f in self.content_log_files():
                fh.write(f"===== {f} =====\n")
                with open(os.path.join(self.dir, f), encoding="utf-8", errors="replace") as src:
                    fh.write(src.read())
        return out

    def close(self):
        self.stop()
        if self.console:
            self.console.close()
            self.console = None


# ------------------------------------------------------------------------------- packs
def pack_ref(pack_dir):
    m = read_json(os.path.join(pack_dir, "manifest.json"))
    return {"pack_id": m["header"]["uuid"], "version": m["header"]["version"]}


def install_test_pack(world_bp_dir):
    dst = os.path.join(world_bp_dir, "gsh_test_harness")
    shutil.copytree(TEST_PACK, dst)
    os.makedirs(os.path.join(dst, "structures", "gsh_harness"), exist_ok=True)
    nbt_le.write_air_structure(os.path.join(dst, "structures", "gsh_harness", "empty.mcstructure"))
    return dst


def install_addon_bp(src, world_bp_dir, gametest_shim=True):
    """Copy the addon BP. With gametest_shim (default) the copy's script entry is wrapped by a
    tiny file that first imports @minecraft/server-gametest: without it, SimulatedPlayers are
    returned as `undefined` by world.getPlayers() in the addon's script context."""
    dst = os.path.join(world_bp_dir, os.path.basename(os.path.normpath(src)))
    shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
    if not gametest_shim:
        return dst
    mpath = os.path.join(dst, "manifest.json")
    m = read_json(mpath)
    for mod in m.get("modules", []):
        if mod.get("type") != "script":
            continue
        entry = mod["entry"]
        entry_dir, entry_file = os.path.split(entry)
        wrapper_rel = os.path.join(entry_dir, WRAPPER_NAME) if entry_dir else WRAPPER_NAME
        with open(os.path.join(dst, wrapper_rel), "w", encoding="utf-8") as fh:
            fh.write(
                "// Written by tools/bds_test/bds.py for harness runs only (never shipped).\n"
                "// Loading the GameTest module in this script context makes GameTest SimulatedPlayers\n"
                "// visible to world.getPlayers(); the addon code itself is unchanged.\n"
                'import "@minecraft/server-gametest";\n'
                f'import "./{entry_file}";\n'
            )
        mod["entry"] = wrapper_rel.replace(os.sep, "/")
    deps = m.setdefault("dependencies", [])
    if not any(d.get("module_name") == GAMETEST_MODULE["module_name"] for d in deps):
        deps.append(dict(GAMETEST_MODULE))
    write_json(mpath, m)
    return dst


# ------------------------------------------------------------------------------- harness
class SimPlayer:
    """Proxy for one GameTest SimulatedPlayer (all calls go through the test pack)."""

    def __init__(self, h, name):
        self.h = h
        self.name = name

    def _c(self, op, **kw):
        return self.h.call(op, name=self.name, **kw)

    # state from the latest probe
    @property
    def state(self):
        return self.h.player(self.name)

    @property
    def loc(self):
        st = self.state
        return tuple(st["loc"]) if st and st.get("loc") else None

    @property
    def hp(self):
        st = self.state
        return st.get("hp") if st else None

    # movement
    def tp(self, x, y, z, yaw=None, pitch=None, dim=None):
        kw = dict(x=x, y=y, z=z)
        if yaw is not None:
            kw["yaw"] = yaw
        if pitch is not None:
            kw["pitch"] = pitch
        if dim:
            kw["dim"] = dim
        return self._c("tp", **kw)

    def place(self, x, z, search=8, yaw=None):
        kw = dict(x=x, z=z, search=search)
        if yaw is not None:
            kw["yaw"] = yaw
        return self._c("place", timeout=60, **kw)["loc"]

    def move(self, fb=1.0, lr=0.0, speed=1.0):
        return self._c("move", fb=fb, lr=lr, speed=speed)

    def move_dir(self, we=0.0, ns=0.0, speed=1.0):
        return self._c("moveDir", we=we, ns=ns, speed=speed)

    def move_to(self, x, y, z, speed=1.0, face=True):
        return self._c("moveTo", x=x, y=y, z=z, speed=speed, face=face)

    def navigate_to(self, x, y, z, speed=1.0):
        return self._c("navTo", x=x, y=y, z=z, speed=speed)

    def navigate_to_entity(self, target=None, speed=1.0):
        return self._c("navEntity", target=target or {"type": SPIDER}, speed=speed)

    def stop(self):
        return self._c("stop")

    def sprint(self, on=True):
        return self._c("sprint", on=on)

    def jump(self):
        return self._c("jump")

    def rotate(self, yaw):
        return self._c("rotate", yaw=yaw)

    # looking / fighting
    def look_at(self, x, y, z, mode="continuous"):
        return self._c("look", x=x, y=y, z=z, mode=mode)

    def look_at_entity(self, target=None, mode="continuous"):
        return self._c("look", target=target or {"type": SPIDER}, mode=mode)

    def attack(self, target=None):
        return self._c("attack", target=target or {"type": SPIDER})

    # air
    def hold(self, x=None, y=None, z=None):
        kw = {} if x is None else dict(x=x, y=y, z=z)
        return self._c("hold", **kw)

    def release(self):
        return self._c("release")

    def glide(self, equip=True):
        return self._c("glide", equip=equip)

    def stop_gliding(self):
        return self._c("stopGlide")

    def fly(self):
        return self._c("fly")

    def stop_flying(self):
        return self._c("stopFly")

    # life cycle
    def gamemode(self, gm):
        return self._c("gamemode", gm=gm)

    def kill(self):
        return self._c("kill")

    def damage(self, amount, cause="override"):
        return self._c("damage", amount=amount, cause=cause)

    def heal(self):
        return self._c("heal")

    def respawn(self):
        return self._c("respawn")

    def disconnect(self):
        r = self._c("disconnect")
        self.h.sims.pop(self.name, None)
        return r

    def remove(self):
        r = self._c("remove")
        self.h.sims.pop(self.name, None)
        return r

    # items / commands
    def effect(self, effect, seconds=30, amp=0, particles=False):
        return self._c("effect", effect=effect, seconds=seconds, amp=amp, particles=particles)

    def give(self, item, count=1, slot=None, select=True):
        kw = dict(item=item, count=count, select=select)
        if slot is not None:
            kw["slot"] = slot
        return self._c("give", **kw)

    def use_on_block(self, x, y, z, slot=0, face="Up"):
        return self._c("useOnBlock", x=x, y=y, z=z, slot=slot, face=face)

    def inventory(self):
        return self._c("inventory")["items"]

    def run(self, command, check=True):
        """Run a command with this player as source (e.g. 'scriptevent gsh:spawn')."""
        return self.h.call("cmd", name=self.name, command=command, check=check)

    def chat(self, message):
        return self._c("chat", message=message)


class Harness:
    """High-level scenario API: server + test pack session + simulated players + probes."""

    def __init__(self, name, seed=DEFAULT_SEED, addon=True, addon_bp=ADDON_BP, addon_rp=ADDON_RP,
                 extra_bps=(), extra_rps=(), test_pack=True, gametest_shim=True, port=None,
                 difficulty="normal", gamemode="survival", tick_distance=4, view_distance=10,
                 probe_every=20, quiet=True, properties=None, runs_dir=None):
        self.name = name
        self.run_dir = os.path.join(runs_dir or RUNS_DIR, name)
        self.seed = seed
        self.addon = addon
        self.addon_bp = addon_bp
        self.addon_rp = addon_rp
        self.extra_bps = list(extra_bps)
        self.extra_rps = list(extra_rps)
        self.test_pack = test_pack
        self.gametest_shim = gametest_shim
        self.probe_every = probe_every
        self.quiet = quiet
        self.server = BDSServer(name, self.run_dir, seed=seed, port=port, gamemode=gamemode,
                                difficulty=difficulty, tick_distance=tick_distance,
                                view_distance=view_distance, properties=properties,
                                on_line=self._on_line)
        self.cond = threading.Condition()
        self.seq = 0
        self.acks = {}
        self.probes = []
        self.events = []
        self.session_id = 0
        self.session_failed = None
        self.script_errors = []
        self.t0 = time.time()
        self.timeline = None
        self.checks = []
        self.notes = []
        self.sims = {}  # name -> SimPlayer (only players spawned through this harness)
        self.sim_gm = {}
        self.ready_count = 0
        self.line_waiters = []  # [(regex, list_to_fill, event)]

    # ---------------------------------------------------------------- output parsing
    def now(self):
        return round(time.time() - self.t0, 3)

    def _record(self, obj):
        obj.setdefault("wall", self.now())
        if self.timeline:
            self.timeline.write(json.dumps(obj, separators=(",", ":")) + "\n")
            self.timeline.flush()

    def _on_line(self, line):
        if self.line_waiters:
            for rx, box, ev in list(self.line_waiters):
                mm = rx.search(line)
                if mm and not ev.is_set():
                    box.append(mm)
                    ev.set()
        m = BDSServer.GSHT_RE.search(line)
        if m:
            try:
                obj = json.loads(m.group(1))
            except ValueError:
                obj = {"t": "bad", "raw": line[:2000]}
            obj["wall"] = self.now()
            with self.cond:
                self._record(obj)
                t = obj.get("t")
                if t == "ack":
                    self.acks[obj.get("seq")] = obj
                elif t == "probe":
                    self.probes.append(obj)
                elif t == "ev":
                    self.events.append(obj)
                elif t == "session":
                    self.session_id = obj.get("id", 0)
                elif t == "ready":
                    self.ready_count += 1
                self.cond.notify_all()
            return
        if "onTestFailed: gsh_harness:session" in line:
            with self.cond:
                self.session_failed = line.strip()
                self._record({"t": "sessionEnded", "line": line.strip()})
                self.cond.notify_all()
            return
        if "[Scripting]" in line or "ERROR" in line or line.startswith("onTest"):
            rec = {"t": "log", "line": line[:4000]}
            if " ERROR]" in line:
                self.script_errors.append(line)
            with self.cond:
                self._record(rec)

    # ---------------------------------------------------------------- lifecycle
    def start(self):
        log(f"[{self.name}] preparing fresh server in {self.server.dir}")
        self.server.create()
        self.timeline = open(os.path.join(self.run_dir, "timeline.jsonl"), "w", encoding="utf-8")
        # first boot generates the world (no packs)
        self.server.start()
        self.server.stop()
        if not os.path.exists(self.server.level_dat()):
            raise HarnessError("world was not generated")
        if self.test_pack:
            exp = nbt_le.enable_experiments(self.server.level_dat(), ["gametest"])
            self.note(f"level.dat experiments: {exp}")
        self._install_packs()
        self._boot()
        return self

    def _install_packs(self):
        bp_dir = os.path.join(self.server.world, "behavior_packs")
        rp_dir = os.path.join(self.server.world, "resource_packs")
        os.makedirs(bp_dir, exist_ok=True)
        os.makedirs(rp_dir, exist_ok=True)
        bps, rps = [], []
        if self.test_pack:
            bps.append(pack_ref(install_test_pack(bp_dir)))
        if self.addon:
            for d in (self.addon_bp, self.addon_rp):
                if not os.path.isfile(os.path.join(d, "manifest.json")):
                    raise HarnessError(f"addon pack missing: {d}")
            bps.append(pack_ref(install_addon_bp(self.addon_bp, bp_dir, self.gametest_shim and self.test_pack)))
            dst = os.path.join(rp_dir, os.path.basename(os.path.normpath(self.addon_rp)))
            shutil.copytree(self.addon_rp, dst)
            rps.append(pack_ref(dst))
        for d in self.extra_bps:
            dst = os.path.join(bp_dir, os.path.basename(os.path.normpath(d)))
            shutil.copytree(d, dst)
            bps.append(pack_ref(dst))
        for d in self.extra_rps:
            dst = os.path.join(rp_dir, os.path.basename(os.path.normpath(d)))
            shutil.copytree(d, dst)
            rps.append(pack_ref(dst))
        write_json(os.path.join(self.server.world, "world_behavior_packs.json"), bps)
        write_json(os.path.join(self.server.world, "world_resource_packs.json"), rps)
        self.note(f"installed BPs {[b['pack_id'] for b in bps]} RPs {[r['pack_id'] for r in rps]}")

    def _boot(self):
        with self.cond:
            self.session_failed = None
        self._record({"t": "mark", "label": f"boot #{self.server.boots + 1}"})
        self.server.start()
        if self.test_pack:
            self.start_session()
            self.call("probe", every=self.probe_every)
            if self.quiet:
                self.quiet_world()

    def start_session(self, attempts=3):
        """Start (or restart) the long-running GameTest that owns the simulated players."""
        for attempt in range(attempts):
            with self.cond:
                before = self.session_id
                self.session_failed = None
            self.server.send("gametest run gsh_harness:session")
            deadline = time.time() + 30
            with self.cond:
                while time.time() < deadline:
                    if self.session_id != before:
                        return self.session_id
                    if self.session_failed:
                        break
                    self.cond.wait(0.25)
            log(f"session start attempt {attempt + 1} failed ({self.session_failed or 'timeout'})")
            self.server.send("gametest clearall")
            time.sleep(1)
        raise HarnessError("could not start the GameTest session")

    def quiet_world(self):
        """Daytime, no weather, no natural mob spawning (keeps vanilla mobs out of results)."""
        for c in ("time set noon", "gamerule dodaylightcycle false", "gamerule doweathercycle false",
                  "weather clear", "gamerule domobspawning false", "gamerule doinsomnia false",
                  "gamerule showcoordinates true", "gamerule sendcommandfeedback true"):
            self.server.send(c)

    def stop(self):
        self._record({"t": "mark", "label": "stop"})
        self.server.stop()

    def restart(self, respawn=True, wait=2.0):
        """Save + stop the server, boot it again (world kept). Simulated players do not survive a
        restart; with respawn=True they are spawned again at their last probed position."""
        last = {}
        for name in list(self.sims):
            st = self.player(name)
            if st and st.get("loc"):
                last[name] = (st["loc"], st.get("gm") or self.sim_gm.get(name, "survival"), st.get("dim"))
        self.stop()
        self.sims.clear()
        time.sleep(wait)
        self._boot()
        out = {}
        if respawn:
            for name, (l, gm, d) in last.items():
                out[name] = self.spawn(name, x=l[0], y=l[1] + 0.2, z=l[2], gm=gm, dim=d)
        return out

    def finish(self):
        try:
            self.server.close()
        finally:
            self.server.collect_content_log()
            if self.timeline:
                self.timeline.close()
                self.timeline = None

    # ---------------------------------------------------------------- commands
    def cmd(self, command):
        """Raw console command (no result)."""
        self.server.send(command)

    def console_query(self, command, pattern, timeout=30):
        """Send a console command and return the regex match of the first output line matching
        `pattern` (None on timeout). E.g. console_query('locate biome forest', r'at block')."""
        rx = re.compile(pattern)
        box, ev = [], threading.Event()
        item = (rx, box, ev)
        self.line_waiters.append(item)
        try:
            self.server.send(command)
            ev.wait(timeout)
            return box[0] if box else None
        finally:
            self.line_waiters.remove(item)

    def call(self, op, timeout=30, check=True, **kw):
        """Send one op to the test pack and wait for its ack. Returns ack['data']."""
        with self.cond:
            self.seq += 1
            seq = self.seq
        payload = dict(kw, op=op, seq=seq)
        text = json.dumps(payload, separators=(",", ":"))
        if len(text) > 1900:
            raise HarnessError(f"op payload too long ({len(text)} chars)")
        self.server.send("scriptevent gsht:cmd " + text)
        deadline = time.time() + timeout
        with self.cond:
            while seq not in self.acks:
                left = deadline - time.time()
                if left <= 0:
                    raise HarnessError(f"timeout waiting for ack of {op} (seq {seq})")
                if not self.server.running():
                    raise HarnessError(f"server stopped while waiting for {op}")
                self.cond.wait(min(left, 0.5))
            ack = self.acks.pop(seq)
        if not ack.get("ok"):
            if check:
                raise HarnessError(f"{op} failed: {ack.get('err')}")
            return {"error": ack.get("err"), "ok": False}
        data = ack.get("data")
        return data if data is not None else {}

    # ---------------------------------------------------------------- players
    def spawn(self, name, x=None, z=None, y=None, gm="survival", search=8, yaw=None, dim=None):
        """Spawn a simulated player. With x/z and no y it is put on dry ground near x/z."""
        kw = dict(name=name, gm=gm)
        if x is not None and z is not None:
            kw.update(x=x, z=z, search=search)
            if y is not None:
                kw["y"] = y
            if yaw is not None:
                kw["yaw"] = yaw
        if dim:
            kw["dim"] = dim
        res = self.call("spawn", timeout=60, **kw)
        p = SimPlayer(self, name)
        self.sims[name] = p
        self.sim_gm[name] = gm
        self._record({"t": "mark", "label": f"spawned {name}", "data": res})
        return p

    def get(self, name):
        return self.sims.get(name) or SimPlayer(self, name)

    # ---------------------------------------------------------------- world helpers
    def find_biome(self, biome="minecraft:forest", x=0, z=0, size=4096):
        return self.call("findBiome", timeout=60, biome=biome, x=x, y=64, z=z, size=size)["loc"]

    def forest(self, x=0, z=0):
        """(x, z) of the closest forest biome to x/z (any of forest/birch/dark/flower forest)."""
        best = None
        for b in ("minecraft:forest", "minecraft:birch_forest", "minecraft:roofed_forest", "minecraft:flower_forest"):
            r = self.call("findBiome", timeout=60, check=False, biome=b, x=x, y=64, z=z, size=4096)
            l = r.get("loc") if isinstance(r, dict) else None
            if l:
                d = (l[0] - x) ** 2 + (l[2] - z) ** 2
                if best is None or d < best[0]:
                    best = (d, l)
        if not best:
            raise HarnessError("no forest found near the origin; try another --seed")
        return best[1][0], best[1][2]

    def summon(self, x, y, z, event=None):
        ev = f" {event}" if event else ""
        return self.call("cmd", command=f"summon {SPIDER} {x} {y} {z}{ev}", check=False)

    def scriptevent(self, ident, message="", player=None):
        """`/scriptevent` (e.g. gsh:spawn) - from a player when given, else from the console."""
        if player:
            return self.call("cmd", name=player, command=f"scriptevent {ident} {message}".strip(), check=False)
        self.server.send(f"scriptevent {ident} {message}".strip())
        return {}

    def set_config(self, key, value, player=None):
        return self.scriptevent("gsh:config", f"{key} {value}", player=player)

    # ---------------------------------------------------------------- observation
    def last_probe(self):
        with self.cond:
            return self.probes[-1] if self.probes else None

    def snap(self):
        """Fresh probe right now (not periodic)."""
        return self.call("snap")

    def player(self, name, probe=None):
        p = probe or self.last_probe()
        if not p:
            return None
        for st in p.get("players", []):
            if st.get("name") == name:
                return st
        return None

    def spiders(self, probe=None):
        p = probe or self.last_probe()
        return [s for s in (p or {}).get("spiders", []) if s.get("type") == SPIDER]

    def spider_state(self, s):
        return (s.get("props") or {}).get("horror:state")

    def evs(self, ev=None, since=0.0, **match):
        """Events (optionally of one kind) with wall >= since and matching key/values."""
        with self.cond:
            out = []
            for e in self.events:
                if ev and e.get("ev") != ev:
                    continue
                if e.get("wall", 0) < since:
                    continue
                if all(_dig(e, k) == v for k, v in match.items()):
                    out.append(e)
            return out

    def hurts(self, victim=None, damager_type=None, since=0.0):
        out = []
        for e in self.evs("hurt", since=since):
            v = e.get("victim") or {}
            d = e.get("damager") or {}
            if victim and v.get("name") != victim:
                continue
            if damager_type and d.get("type") != damager_type:
                continue
            out.append(e)
        return out

    def probes_since(self, since):
        with self.cond:
            return [p for p in self.probes if p.get("wall", 0) >= since]

    def wait(self, seconds):
        """Real-time wait (the server runs at 20 ticks/s)."""
        end = time.time() + seconds
        while True:
            left = end - time.time()
            if left <= 0:
                return
            if not self.server.running():
                raise HarnessError("server stopped unexpectedly")
            time.sleep(min(left, 0.5))

    def wait_until(self, pred, timeout, desc="condition", poll=0.25):
        """Poll pred(h) until truthy (returns its value) or timeout (returns None)."""
        end = time.time() + timeout
        while time.time() < end:
            if not self.server.running():
                raise HarnessError("server stopped unexpectedly")
            v = pred(self)
            if v:
                return v
            time.sleep(poll)
        self.note(f"timeout after {timeout}s waiting for {desc}")
        return None

    def mark(self, label):
        t = self.now()
        with self.cond:
            self._record({"t": "mark", "label": label, "wall": t})
        log(f"[{self.name}] t={t:7.1f}s {label}")
        return t

    # ---------------------------------------------------------------- verdicts
    def check(self, cond, what, **details):
        ok = bool(cond)
        rec = {"ok": ok, "what": what, "wall": self.now()}
        if details:
            rec["details"] = details
        self.checks.append(rec)
        with self.cond:
            self._record(dict(rec, t="check"))
        log(f"[{self.name}] {'PASS' if ok else 'FAIL'}: {what}" + (f"  {details}" if details and not ok else ""))
        return ok

    def require(self, cond, what, **details):
        if not self.check(cond, what, **details):
            raise HarnessError(f"required check failed: {what}")

    def note(self, msg):
        self.notes.append(msg)
        with self.cond:
            self._record({"t": "note", "msg": msg})

    def content_log_errors(self):
        out = []
        for f in self.server.content_log_files():
            with open(os.path.join(self.server.dir, f), encoding="utf-8", errors="replace") as fh:
                for line in fh:
                    if "[error]" in line.lower():
                        out.append(line.strip())
        return out


def _dig(obj, dotted):
    for part in dotted.split("."):
        if not isinstance(obj, dict):
            return None
        obj = obj.get(part)
    return obj


# ------------------------------------------------------------------------------- scenarios
def scenario_names():
    return sorted(f[:-3] for f in os.listdir(SCENARIO_DIR) if f.endswith(".py") and not f.startswith("_"))


def load_scenario(name):
    path = os.path.join(SCENARIO_DIR, name + ".py")
    if not os.path.isfile(path):
        raise HarnessError(f"unknown scenario {name}; known: {', '.join(scenario_names())}")
    spec = importlib.util.spec_from_file_location(f"gsh_scenario_{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def run_scenario(name, run_name=None, seed=None, addon=None, keep=False, **harness_kw):
    mod = load_scenario(name)
    opts = dict(getattr(mod, "HARNESS", {}))
    opts.update({k: v for k, v in harness_kw.items() if v is not None})
    if seed is not None:
        opts["seed"] = seed
    if addon is not None:
        opts["addon"] = addon
    else:
        opts.setdefault("addon", getattr(mod, "NEEDS_ADDON", True))
    h = Harness(run_name or name, **opts)
    t0 = time.time()
    error = None
    try:
        h.start()
        mod.run(h)
    except Exception as e:  # scenario failure or harness failure
        error = f"{type(e).__name__}: {e}"
        h.note("exception: " + "".join(traceback.format_exception(e))[-3000:])
        log(f"[{h.name}] ERROR {error}")
    finally:
        try:
            h.finish()
        except Exception as e:  # pragma: no cover
            log(f"finish failed: {e}")
    errors = h.content_log_errors()
    passed = error is None and all(c["ok"] for c in h.checks) and len(h.checks) > 0
    result = {
        "scenario": name,
        "run": h.name,
        "passed": passed,
        "error": error,
        "seconds": round(time.time() - t0, 1),
        "seed": h.seed,
        "addon": h.addon,
        "checks": h.checks,
        "notes": h.notes,
        "content_log_errors": errors[:200],
        "script_errors": h.script_errors[:200],
        "probes": len(h.probes),
        "events": len(h.events),
        "run_dir": h.run_dir,
    }
    write_json(os.path.join(h.run_dir, "result.json"), result)
    if not keep:
        shutil.rmtree(os.path.join(h.run_dir, "server", "behavior_packs"), ignore_errors=True)
        shutil.rmtree(os.path.join(h.run_dir, "server", "resource_packs"), ignore_errors=True)
        for f in ("bedrock_server",):
            try:
                os.remove(os.path.join(h.run_dir, "server", f))
            except OSError:
                pass
    return result


def print_result(r):
    status = "PASS" if r["passed"] else "FAIL"
    print(f"== {r['scenario']} [{r['run']}]: {status} ({r['seconds']} s, {r['probes']} probes, {r['events']} events)")
    for c in r["checks"]:
        print(f"   {'ok ' if c['ok'] else 'NOT'} {c['what']}" + ("" if c["ok"] else f"  {c.get('details', '')}"))
    if r["error"]:
        print(f"   error: {r['error']}")
    if r["content_log_errors"]:
        print(f"   content log errors: {len(r['content_log_errors'])} (first: {r['content_log_errors'][0][:200]})")
    print(f"   files: {r['run_dir']}/(result.json, timeline.jsonl, console.log, content_log.txt)")


# ------------------------------------------------------------------------------- CLI
def cmd_run(args):
    names = scenario_names() if args.scenarios == ["all"] else args.scenarios
    if args.scenarios == ["all"]:
        names = [n for n in names if n != "smoke"] + ["smoke"]
    for n in names:
        load_scenario(n)  # fail early on typos
    kw = {}
    if args.tick_distance is not None:
        kw["tick_distance"] = args.tick_distance
    if args.no_shim:
        kw["gametest_shim"] = False
    jobs = []
    results = []

    def work(n):
        run_name = f"{args.prefix}{n}" if args.prefix else n
        return run_scenario(n, run_name=run_name, seed=args.seed,
                            addon=(False if args.no_addon else None), keep=args.keep, **kw)

    if args.jobs <= 1:
        for n in names:
            r = work(n)
            print_result(r)
            results.append(r)
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=args.jobs) as ex:
            jobs = [(n, ex.submit(work, n)) for n in names]
            for n, f in jobs:
                r = f.result()
                print_result(r)
                results.append(r)
    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{len(results)} scenarios passed")
    summary = os.path.join(RUNS_DIR, "summary.json")
    os.makedirs(RUNS_DIR, exist_ok=True)
    write_json(summary, [{k: r[k] for k in ("scenario", "run", "passed", "error", "seconds", "run_dir")} for r in results])
    return 0 if passed == len(results) else 1


def cmd_serve(args):
    """Interactive: boots the server + session; stdin lines starting with '{' are test pack ops
    (e.g. {"op":"spawn","name":"P1","x":0,"z":0}), anything else is a console command."""
    h = Harness(args.name, seed=args.seed, addon=not args.no_addon)
    h.start()
    print("ready. type console commands or JSON ops; 'quit' to stop.", flush=True)
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            if line in ("quit", "exit", "stop"):
                break
            if line.startswith("{"):
                try:
                    req = json.loads(line)
                    op = req.pop("op")
                    print(json.dumps(h.call(op, check=False, **req)), flush=True)
                except Exception as e:
                    print(f"error: {e}", flush=True)
            else:
                h.cmd(line)
    finally:
        h.finish()
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="list scenarios")
    r = sub.add_parser("run", help="run scenarios ('all' for every scenario)")
    r.add_argument("scenarios", nargs="+")
    r.add_argument("--seed", type=int, default=None)
    r.add_argument("-j", "--jobs", type=int, default=1, help="parallel servers")
    r.add_argument("--prefix", default="", help="run directory name prefix")
    r.add_argument("--keep", action="store_true", help="keep the full server copy after the run")
    r.add_argument("--no-addon", action="store_true", help="do not install the addon packs")
    r.add_argument("--no-shim", action="store_true", help="do not wrap the addon entry with the gametest import")
    r.add_argument("--tick-distance", type=int, default=None)
    s = sub.add_parser("serve", help="interactive server with the test pack")
    s.add_argument("--name", default="dev")
    s.add_argument("--seed", type=int, default=DEFAULT_SEED)
    s.add_argument("--no-addon", action="store_true")
    args = ap.parse_args(argv)
    if args.cmd == "list":
        for n in scenario_names():
            mod = load_scenario(n)
            print(f"{n:18s} {'(addon)' if getattr(mod, 'NEEDS_ADDON', True) else '(no addon)':11s} {getattr(mod, 'DESCRIPTION', '')}")
        return 0
    if args.cmd == "run":
        return cmd_run(args)
    if args.cmd == "serve":
        return cmd_serve(args)
    return 2


if __name__ == "__main__":
    sys.exit(main())
