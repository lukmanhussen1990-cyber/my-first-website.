#!/usr/bin/env python3
"""In-engine test of the horde entity definitions on Bedrock Dedicated Server.

Needs a BDS **1.21.0.26 preview** for Linux, extracted into a directory you
pass with --bds (or $PAS_BDS_DIR). Download it yourself from minecraft.net:
https://www.minecraft.net/bedrockdedicatedserver/bin-linux-preview/bedrock-server-1.21.0.26.zip
Downloading it means accepting the Minecraft EULA.  Nothing from BDS is ever
copied into this repository.

What it does
  * installs pack/ (a test-only script pack) plus addon/behavior_pack/entities
    and addon/behavior_pack/loot_tables as a development behavior pack
  * creates a fresh flat world "pas_engine_test", allow-cheats, normal difficulty
  * starts BDS (stdout captured), waits for PASTEST_DONE, stops the server
  * fails if any PASTEST line failed, or if the content log printed a
    [Json]/[Actor]/[Molang] error or warning for our pack
  * restores the original server.properties afterwards

If the kernel has no IPv6 (some containers), BDS refuses to start; a tiny
LD_PRELOAD shim (fake6.c, compiled on the fly with cc) then emulates the IPv6
UDP socket with an IPv4 one.  No client ever connects.

Usage:  python3 tools/entities/engine_test/run_engine_test.py --bds /path/to/bds [--timeout 900]
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
BP = REPO / "addon" / "behavior_pack"
LEVEL = "pas_engine_test"
PACK_DIR_NAME = "pas_entity_engine_test"


def ipv6_ok() -> bool:
    try:
        socket.socket(socket.AF_INET6, socket.SOCK_DGRAM).close()
        return True
    except OSError:
        return False


def build_shim(tmp: Path) -> Path:
    out = tmp / "fake6.so"
    subprocess.run(["cc", "-shared", "-fPIC", "-O2", "-o", str(out), str(HERE / "fake6.c"), "-ldl"], check=True)
    return out


def write_props(bds: Path) -> str:
    p = bds / "server.properties"
    original = p.read_text(encoding="utf-8")
    want = {
        "allow-cheats": "true", "level-name": LEVEL, "level-type": "FLAT", "difficulty": "normal",
        "content-log-file-enabled": "true", "online-mode": "false", "server-port": "19432",
        "server-portv6": "19433", "enable-lan-visibility": "false", "gamemode": "creative",
    }
    out, seen = [], set()
    for line in original.splitlines():
        key = line.split("=", 1)[0] if "=" in line and not line.startswith("#") else None
        if key in want:
            out.append(f"{key}={want[key]}")
            seen.add(key)
        else:
            out.append(line)
    out += [f"{k}={v}" for k, v in want.items() if k not in seen]
    p.write_text("\n".join(out) + "\n", encoding="utf-8")
    return original


def install(bds: Path) -> None:
    man = json.loads((HERE / "pack" / "manifest.json").read_text(encoding="utf-8"))
    dev = bds / "development_behavior_packs"
    for other in dev.glob("*/manifest.json"):  # stale copies of this test pack (same uuid)
        try:
            same = json.loads(other.read_text(encoding="utf-8"))["header"]["uuid"] == man["header"]["uuid"]
        except (ValueError, KeyError):
            same = False
        if same:
            shutil.rmtree(other.parent)
    dst = dev / PACK_DIR_NAME
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(HERE / "pack", dst)
    shutil.copytree(BP / "entities", dst / "entities")
    shutil.copytree(BP / "loot_tables", dst / "loot_tables")
    world = bds / "worlds" / LEVEL
    if world.exists():
        shutil.rmtree(world)
    world.mkdir(parents=True)
    (world / "world_behavior_packs.json").write_text(json.dumps(
        [{"pack_id": man["header"]["uuid"], "version": man["header"]["version"]}]), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bds", default=os.environ.get("PAS_BDS_DIR"), help="extracted BDS 1.21.0.26 directory")
    ap.add_argument("--timeout", type=float, default=900)
    args = ap.parse_args()
    if not args.bds or not (Path(args.bds) / "bedrock_server").is_file():
        print("SKIP: no BDS directory (use --bds or PAS_BDS_DIR)")
        return 0
    bds = Path(args.bds).resolve()
    original_props = write_props(bds)
    lines: list[str] = []
    try:
        install(bds)
        env = dict(os.environ, LD_LIBRARY_PATH=str(bds))
        tmp = Path(tempfile.mkdtemp(prefix="pas_bds_"))
        if not ipv6_ok():
            env["LD_PRELOAD"] = str(build_shim(tmp))
            print("note: no IPv6 in this kernel, using fake6 shim")
        proc = subprocess.Popen(["./bedrock_server"], cwd=bds, env=env, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        done = threading.Event()

        def reader():
            assert proc.stdout is not None
            for line in proc.stdout:
                line = line.rstrip("\n")
                lines.append(line)
                if "PASTEST" in line or "ERROR" in line or "[Json]" in line or "[Actor]" in line:
                    print(line, flush=True)
                if "PASTEST_DONE" in line or "Exiting program" in line:
                    done.set()
            done.set()

        threading.Thread(target=reader, daemon=True).start()
        finished = done.wait(timeout=args.timeout)
        try:
            assert proc.stdin is not None
            proc.stdin.write("stop\n")
            proc.stdin.flush()
        except (BrokenPipeError, OSError):
            pass
        try:
            proc.wait(timeout=60)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(tmp, ignore_errors=True)
    finally:
        (bds / "server.properties").write_text(original_props, encoding="utf-8")

    fails = [l for l in lines if "PASTEST|" in l and "|FAIL|" in l]
    passes = [l for l in lines if "PASTEST|" in l and "|PASS|" in l]
    content = [l for l in lines if any(t in l for t in ("[Json]", "[Actor]", "[Molang]", "[Entity]"))
               and ("ERROR" in l or "WARN" in l)]
    done_line = next((l for l in lines if "PASTEST_DONE" in l), None)
    print(f"\n{len(passes)} passed, {len(fails)} failed, {len(content)} content-log problems")
    if not finished or done_line is None or "ERROR" in (done_line or ""):
        print("FAILED: test run did not complete:", done_line)
        return 1
    if fails or content:
        for l in fails + content:
            print("  ", l)
        return 1
    print("ENGINE TEST OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
