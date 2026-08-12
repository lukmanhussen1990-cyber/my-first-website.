#!/usr/bin/env python3
"""Builds dist/Luxury_Tech_Mycelium_X.mcaddon.

Regenerates everything, validates, packages, then re-opens the archive and
verifies it — a .mcaddon is only a zip, and the failure mode this guards
against is shipping a renamed broken zip.

Run: python3 tools/build.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
SRC = ROOT / "src"
DIST = ROOT / "dist"

ADDON_NAME = "Luxury_Tech_Mycelium_X.mcaddon"
PACK_DIRS = {
    "behavior_pack": "Luxury_Tech_Mycelium_X_BP",
    "resource_pack": "Luxury_Tech_Mycelium_X_RP",
}

# Editor and OS droppings must never reach the archive: Minecraft will try to
# parse stray files in content directories and can reject the pack.
EXCLUDE_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}
EXCLUDE_SUFFIXES = {".pyc", ".bak", ".orig", ".rej", ".swp"}
EXCLUDE_DIRS = {"__pycache__", ".git", ".idea", ".vscode"}

GENERATORS = [
    "gen_textures.py",
    "gen_entity_art.py",
    "gen_content.py",
    "gen_functions.py",
    "gen_mansion.py",
    "gen_mansion_data.py",
]


def run(script: str) -> None:
    path = TOOLS / script
    if not path.exists():
        print(f"  skip {script} (not present)")
        return
    result = subprocess.run(
        [sys.executable, str(path)], capture_output=True, text=True, cwd=ROOT
    )
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(f"generator {script} failed")
    last = [line for line in result.stdout.strip().splitlines() if line.strip()]
    print(f"  {script}: {last[-1] if last else 'ok'}")


def collect(pack_root: Path) -> list[Path]:
    files = []
    for path in sorted(pack_root.rglob("*")):
        if not path.is_file():
            continue
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        if path.name in EXCLUDE_NAMES or path.suffix in EXCLUDE_SUFFIXES:
            continue
        files.append(path)
    return files


def build() -> Path:
    DIST.mkdir(exist_ok=True)
    target = DIST / ADDON_NAME
    if target.exists():
        target.unlink()

    written: list[str] = []
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for source_dir, archive_dir in PACK_DIRS.items():
            pack_root = SRC / source_dir
            files = collect(pack_root)
            if not files:
                raise SystemExit(f"{source_dir} is empty")
            if not (pack_root / "manifest.json").exists():
                raise SystemExit(f"{source_dir}/manifest.json is missing")
            for path in files:
                # Always forward slashes: Minecraft reads these paths verbatim.
                arcname = f"{archive_dir}/{path.relative_to(pack_root).as_posix()}"
                archive.write(path, arcname)
                written.append(arcname)
    return target


def verify(target: Path) -> None:
    """Re-open the archive and prove it is a well-formed two-pack .mcaddon."""
    problems: list[str] = []

    with zipfile.ZipFile(target) as archive:
        bad = archive.testzip()
        if bad:
            problems.append(f"corrupt entry: {bad}")

        names = archive.namelist()
        if not names:
            problems.append("archive is empty")

        for name in names:
            if name.startswith("/") or ".." in name.split("/"):
                problems.append(f"unsafe path in archive: {name}")
            if "\\" in name:
                problems.append(f"backslash in archive path: {name}")
            if name.startswith("__MACOSX"):
                problems.append(f"junk entry: {name}")

        uuids: dict[str, str] = {}
        for archive_dir in PACK_DIRS.values():
            manifest_name = f"{archive_dir}/manifest.json"
            if manifest_name not in names:
                problems.append(f"missing {manifest_name}")
                continue
            try:
                manifest = json.loads(archive.read(manifest_name).decode("utf-8-sig"))
            except json.JSONDecodeError as exc:
                problems.append(f"{manifest_name} is not valid JSON: {exc}")
                continue

            header = manifest.get("header", {})
            uuid_value = header.get("uuid")
            if uuid_value in uuids:
                problems.append(
                    f"{manifest_name} reuses UUID {uuid_value} from {uuids[uuid_value]}"
                )
            uuids[uuid_value] = manifest_name
            if header.get("min_engine_version") != [1, 21, 0]:
                problems.append(f"{manifest_name}: unexpected min_engine_version")

            # A pack folder must sit at the archive root, one level deep.
            if not any(n.startswith(f"{archive_dir}/") for n in names):
                problems.append(f"{archive_dir}/ has no contents")

        # Every referenced script file must actually be inside the archive.
        bp_dir = PACK_DIRS["behavior_pack"]
        if f"{bp_dir}/manifest.json" in names:
            manifest = json.loads(archive.read(f"{bp_dir}/manifest.json").decode("utf-8-sig"))
            for module in manifest.get("modules", []):
                entry = module.get("entry")
                if entry and f"{bp_dir}/{entry}" not in names:
                    problems.append(f"script entry {entry} is not in the archive")

        script_files = [n for n in names if n.endswith(".js")]
        png_files = [n for n in names if n.endswith(".png")]
        functions = [n for n in names if n.endswith(".mcfunction")]

    if problems:
        for problem in problems:
            print(f"  ERROR {problem}")
        raise SystemExit("archive verification FAILED")

    size_kb = target.stat().st_size / 1024
    print(f"  entries: {len(names)}")
    print(f"  scripts: {len(script_files)}   textures: {len(png_files)}   functions: {len(functions)}")
    print(f"  size: {size_kb:.1f} KiB")


def main() -> None:
    print("Generating content ...")
    for script in GENERATORS:
        run(script)

    print("\nValidating ...")
    result = subprocess.run(
        [sys.executable, str(TOOLS / "validate.py")], text=True, cwd=ROOT
    )
    if result.returncode != 0:
        raise SystemExit("validation failed — refusing to package")

    print("\nPackaging ...")
    target = build()

    print("\nVerifying archive ...")
    verify(target)

    print(f"\nBUILD OK -> {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
