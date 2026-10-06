"""Bedrock Dedicated Server control for the engine harness.

The extracted BDS directory (--bds) is never modified: every run works in a
*shadow instance* directory whose read-only parts (the server binary, vanilla
packs, definitions) are symlinks into the BDS directory and whose writable parts
(server.properties, worlds/, development_*_packs/, content logs, config/) are
private.  So the teammate's server.properties is untouched by construction and
two harnesses never share a world.

Server processes run in their own process group; stop() sends `stop`, waits,
then SIGTERM, then SIGKILL to the whole group.  An atexit hook and SIGINT/SIGTERM
handlers make sure no bedrock_server is left behind.
"""
from __future__ import annotations

import atexit
import os
import re
import shutil
import signal
import socket
import subprocess
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent

# read-only entries shared with the extracted server (symlinked)
SHARED = ("bedrock_server", "behavior_packs", "resource_packs", "definitions")
# small files copied so the server may rewrite them freely
COPIED = ("permissions.json", "allowlist.json", "server.properties")

_LIVE: set["Server"] = set()


def _cleanup_all() -> None:
    for s in list(_LIVE):
        try:
            s.kill()
        except Exception:  # noqa: BLE001 - best effort at exit
            pass


atexit.register(_cleanup_all)


def _on_signal(signum, _frame):
    _cleanup_all()
    raise SystemExit(128 + signum)


def install_signal_handlers() -> None:
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        try:
            signal.signal(sig, _on_signal)
        except (ValueError, OSError):
            pass


def ipv6_ok() -> bool:
    try:
        socket.socket(socket.AF_INET6, socket.SOCK_DGRAM).close()
        return True
    except OSError:
        return False


def free_udp_port(avoid: set[int] | None = None) -> int:
    avoid = avoid or set()
    for _ in range(50):
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
        s.close()
        if port not in avoid and port > 1024:
            return port
    raise RuntimeError("no free UDP port")


def build_shim(out_dir: Path) -> Path:
    out = out_dir / "fake6.so"
    subprocess.run(["cc", "-shared", "-fPIC", "-O2", "-o", str(out), str(HERE / "fake6.c"), "-ldl"],
                   check=True, capture_output=True)
    return out


def check_bds_dir(bds: Path) -> str | None:
    """None if `bds` looks like an extracted Linux BDS, else the reason."""
    if not (bds / "bedrock_server").is_file():
        return f"{bds}/bedrock_server not found"
    for d in ("behavior_packs", "resource_packs", "definitions", "config"):
        if not (bds / d).is_dir():
            return f"{bds}/{d}/ missing"
    return None


def make_instance(bds: Path, inst: Path) -> None:
    """(Re)create the shadow instance directory `inst` for the server in `bds`."""
    if inst.exists():
        shutil.rmtree(inst)
    inst.mkdir(parents=True)
    for name in SHARED:
        (inst / name).symlink_to(bds / name)
    for name in COPIED:
        if (bds / name).is_file():
            shutil.copy2(bds / name, inst / name)
    shutil.copytree(bds / "config", inst / "config")
    for d in ("worlds", "development_behavior_packs", "development_resource_packs", "development_skin_packs"):
        (inst / d).mkdir()


def write_properties(inst: Path, want: dict[str, str]) -> None:
    """Rewrite the instance's server.properties with `want` applied (other keys kept)."""
    p = inst / "server.properties"
    original = p.read_text(encoding="utf-8") if p.exists() else ""
    out, seen = [], set()
    for line in original.splitlines():
        key = line.split("=", 1)[0].strip() if "=" in line and not line.lstrip().startswith("#") else None
        if key in want:
            out.append(f"{key}={want[key]}")
            seen.add(key)
        else:
            out.append(line)
    out += [f"{k}={v}" for k, v in want.items() if k not in seen]
    p.write_text("\n".join(out) + "\n", encoding="utf-8")


class Server:
    """One bedrock_server process with a line buffer and a console."""

    def __init__(self, inst: Path, bds: Path, shim: Path | None, echo=None, log_file: Path | None = None):
        self.inst = inst
        self.bds = bds
        self.shim = shim
        self.echo = echo  # callable(line) for live output, or None
        self.log_file = log_file
        self.lines: list[str] = []
        self.cond = threading.Condition()
        self.proc: subprocess.Popen | None = None
        self.exited = False
        self.started_at = 0.0

    # ------------------------------------------------------------ lifecycle
    def start(self) -> None:
        env = dict(os.environ, LD_LIBRARY_PATH=str(self.bds))
        if self.shim:
            env["LD_PRELOAD"] = str(self.shim)
        self.proc = subprocess.Popen(
            ["./bedrock_server"], cwd=self.inst, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1, errors="replace", start_new_session=True)
        self.started_at = time.time()
        _LIVE.add(self)
        threading.Thread(target=self._reader, daemon=True).start()

    def _reader(self) -> None:
        assert self.proc and self.proc.stdout
        fh = open(self.log_file, "a", encoding="utf-8") if self.log_file else None
        try:
            for raw in self.proc.stdout:
                line = raw.rstrip("\n")
                if fh:
                    fh.write(line + "\n")
                    fh.flush()
                with self.cond:
                    self.lines.append(line)
                    self.cond.notify_all()
                if self.echo:
                    try:
                        self.echo(line)
                    except Exception:  # noqa: BLE001
                        pass
        finally:
            if fh:
                fh.close()
            with self.cond:
                self.exited = True
                self.cond.notify_all()

    def alive(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def send(self, command: str) -> bool:
        if not self.alive():
            return False
        try:
            assert self.proc and self.proc.stdin
            self.proc.stdin.write(command + "\n")
            self.proc.stdin.flush()
            return True
        except (BrokenPipeError, OSError, ValueError):
            return False

    def wait_for(self, pattern: str | re.Pattern, timeout: float, start: int = 0) -> tuple[int, re.Match] | None:
        """Wait until a line at index >= start matches; returns (index, match) or None on timeout/exit."""
        rx = re.compile(pattern) if isinstance(pattern, str) else pattern
        deadline = time.time() + timeout
        i = start
        with self.cond:
            while True:
                while i < len(self.lines):
                    m = rx.search(self.lines[i])
                    if m:
                        return i, m
                    i += 1
                if self.exited:
                    return None
                left = deadline - time.time()
                if left <= 0:
                    return None
                self.cond.wait(min(left, 1.0))

    def mark(self) -> int:
        with self.cond:
            return len(self.lines)

    def stop(self, timeout: float = 90) -> str:
        """Clean stop. Returns 'clean', 'term' or 'kill' (how the process ended)."""
        if self.proc is None:
            return "clean"
        how = "clean"
        if self.alive():
            self.send("stop")
            try:
                self.proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                how = "term"
                self._signal(signal.SIGTERM)
                try:
                    self.proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    how = "kill"
                    self._signal(signal.SIGKILL)
                    self.proc.wait(timeout=15)
        self._close()
        return how

    def kill(self) -> None:
        if self.proc is None:
            return
        if self.alive():
            self._signal(signal.SIGKILL)
            try:
                self.proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                pass
        self._close()

    def _signal(self, sig) -> None:
        assert self.proc
        try:
            os.killpg(self.proc.pid, sig)
        except (ProcessLookupError, PermissionError):
            try:
                self.proc.send_signal(sig)
            except ProcessLookupError:
                pass

    def _close(self) -> None:
        _LIVE.discard(self)
        if self.proc is not None:
            if self.proc.stdin:
                try:
                    self.proc.stdin.close()
                except OSError:
                    pass
        with self.cond:
            self.cond.notify_all()
