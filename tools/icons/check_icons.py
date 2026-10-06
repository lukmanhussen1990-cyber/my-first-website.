#!/usr/bin/env python3
"""Sanity checks for the generated item icons, pack icons and item_texture fragment.

Checks
  item icons  (addon/resource_pack/textures/items/pas/*.png)
    - exactly the five SPEC §3 icons exist, PNG, mode RGBA, 16x16
    - all four corners fully transparent
    - alpha is binary (0 or 255) - no semi-transparent stray pixels, except
      colours listed in ALLOWED_GLOW for that icon (none are used today)
    - fully transparent pixels are RGB 0 (no colour fringes under mipmapping)
    - 1-px dark outline: every opaque pixel that touches transparency (or the
      image edge) is dark, except the intended light-flare colours
    - enough opaque pixels to read at small size, and not identical to any
      vanilla item texture in the reference pack (when the reference is present)
  pack icons (addon/behavior_pack/pack_icon.png, addon/resource_pack/pack_icon.png)
    - PNG 256x256, fully opaque, not flat, BP and RP icons differ
  fragment (addon/fragments/item_texture/items.json)
    - strict JSON, exactly the five short names, each {"textures": "textures/items/pas/<name>"}
      pointing at an existing PNG
  generator
    - files on disk are pixel-identical to what tools/icons/make_icons.py produces now

Usage: python3 tools/icons/check_icons.py      (exit code 1 on any failure)
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True  # keep tools/icons free of __pycache__
sys.path.insert(0, str(HERE))
import make_icons as M  # noqa: E402
from pack_icon import make_pack_icon  # noqa: E402

ROOT = M.ROOT
DEFAULT_REF = "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"
REF = Path(os.environ.get("PAS_VANILLA_REF", DEFAULT_REF))

DARK_LUMA = 60  # outline pixels must be darker than this (0-255 luma)


def _rgb(hexs: str) -> tuple[int, int, int]:
    return M.hexc(hexs)[:3]


# Bright pixels that may sit on the silhouette edge (the torch's light flare).
ALLOWED_BRIGHT_EDGE: dict[str, set[tuple[int, int, int]]] = {
    "pas_torchlight_on": {_rgb(M.TORCH_LENS_ON["F"]), _rgb(M.TORCH_LENS_ON["f"])},
}
# Semi-transparent colours allowed per icon (intended glow). Empty: all icons use binary alpha.
ALLOWED_GLOW: dict[str, set[tuple[int, int, int]]] = {}

failures: list[str] = []
passes = 0


def check(cond: bool, msg: str) -> None:
    global passes
    if cond:
        passes += 1
    else:
        failures.append(msg)


def luma(rgb: np.ndarray) -> np.ndarray:
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def check_item_icon(name: str, path: Path, vanilla: list[tuple[str, np.ndarray]]) -> None:
    check(path.is_file(), f"{name}: missing {path}")
    if not path.is_file():
        return
    img = Image.open(path)
    check(img.format == "PNG", f"{name}: not a PNG ({img.format})")
    check(img.mode == "RGBA", f"{name}: mode {img.mode}, expected RGBA")
    check(img.size == (16, 16), f"{name}: size {img.size}, expected 16x16")
    if img.size != (16, 16):
        return
    a = np.asarray(img.convert("RGBA")).astype(int)
    alpha = a[..., 3]
    rgb = a[..., :3]
    for (x, y) in ((0, 0), (15, 0), (0, 15), (15, 15)):
        check(alpha[y, x] == 0, f"{name}: corner ({x},{y}) not transparent (alpha {alpha[y, x]})")
    semi = (alpha > 0) & (alpha < 255)
    allowed = ALLOWED_GLOW.get(name, set())
    bad_semi = [(int(x), int(y)) for y, x in zip(*np.nonzero(semi)) if tuple(rgb[y, x]) not in allowed]
    check(not bad_semi, f"{name}: semi-transparent stray pixels at {bad_semi[:8]}")
    clear = alpha == 0
    check(not np.any(rgb[clear]), f"{name}: transparent pixels carry colour (fringe risk)")
    opaque = alpha == 255
    n_opaque = int(opaque.sum())
    check(40 <= n_opaque <= 240, f"{name}: {n_opaque} opaque pixels (expected 40..240)")
    # silhouette edge must be the dark outline
    padded = np.pad(opaque, 1, constant_values=False)
    touches_clear = np.zeros_like(opaque)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        touches_clear |= ~padded[1 + dy:17 + dy, 1 + dx:17 + dx]
    edge = opaque & touches_clear
    bright_ok = ALLOWED_BRIGHT_EDGE.get(name, set())
    bad_edge = []
    lum = luma(rgb)
    for y, x in zip(*np.nonzero(edge)):
        if lum[y, x] >= DARK_LUMA and tuple(rgb[y, x]) not in bright_ok:
            bad_edge.append((int(x), int(y)))
    check(not bad_edge, f"{name}: silhouette pixels that are not dark outline: {bad_edge[:8]}")
    # interior must be lighter than the outline somewhere (icon not just a blob of outline)
    check(int((opaque & ~edge).sum()) >= 20, f"{name}: too few interior pixels")
    # palette discipline: limited colours like vanilla items
    n_colors = len({tuple(c) for c in rgb[opaque]})
    check(3 <= n_colors <= 24, f"{name}: {n_colors} colours (expected 3..24)")
    for vname, varr in vanilla:
        if np.array_equal(varr, a):
            failures.append(f"{name}: identical to vanilla texture {vname}")


def load_vanilla() -> list[tuple[str, np.ndarray]]:
    items = REF / "resource_pack" / "textures" / "items"
    out = []
    if not items.is_dir():
        print(f"note: vanilla reference not found at {items}; skipping copy check")
        return out
    for p in sorted(items.glob("*.png")):
        try:
            im = Image.open(p).convert("RGBA")
        except Exception:  # pragma: no cover - unreadable reference file
            continue
        if im.size == (16, 16):
            out.append((p.name, np.asarray(im).astype(int)))
    return out


def check_pack_icon(label: str, path: Path) -> np.ndarray | None:
    check(path.is_file(), f"{label}: missing {path}")
    if not path.is_file():
        return None
    img = Image.open(path)
    check(img.format == "PNG", f"{label}: not a PNG")
    check(img.size == (256, 256), f"{label}: size {img.size}, expected 256x256")
    a = np.asarray(img.convert("RGBA")).astype(int)
    check(bool(np.all(a[..., 3] == 255)), f"{label}: has transparent pixels")
    check(float(a[..., :3].std()) > 20, f"{label}: looks flat")
    return a


def check_fragment() -> None:
    check(M.FRAGMENT.is_file(), f"fragment missing: {M.FRAGMENT}")
    if not M.FRAGMENT.is_file():
        return
    try:
        data = json.loads(M.FRAGMENT.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        failures.append(f"fragment is not strict JSON: {e}")
        return
    check(set(data) == set(M.ICON_NAMES), f"fragment keys {sorted(data)} != {sorted(M.ICON_NAMES)}")
    for name in M.ICON_NAMES:
        entry = data.get(name)
        want = f"textures/items/pas/{name}"
        check(entry == {"textures": want}, f"fragment[{name}] = {entry!r}, expected {{'textures': '{want}'}}")
        check((ROOT / "addon" / "resource_pack" / (want + ".png")).is_file(), f"fragment[{name}] points at missing PNG")


def check_up_to_date() -> None:
    icons = M.make_item_icons()
    for name, img in icons.items():
        path = M.ITEM_DIR / f"{name}.png"
        if path.is_file():
            same = np.array_equal(np.asarray(Image.open(path).convert("RGBA")), np.asarray(img))
            check(same, f"{name}: file differs from generator output (re-run make_icons.py)")
    for label, path, img in (
        ("BP pack_icon", M.BP_ICON, make_pack_icon("bp")),
        ("RP pack_icon", M.RP_ICON, make_pack_icon("rp", icons["pas_torchlight_on"])),
    ):
        if path.is_file():
            same = np.array_equal(np.asarray(Image.open(path).convert("RGBA")), np.asarray(img))
            check(same, f"{label}: file differs from generator output (re-run make_icons.py)")


def main() -> int:
    vanilla = load_vanilla()
    found = sorted(p.stem for p in M.ITEM_DIR.glob("*.png")) if M.ITEM_DIR.is_dir() else []
    check(found == sorted(M.ICON_NAMES), f"icon set {found} != {sorted(M.ICON_NAMES)}")
    for name in M.ICON_NAMES:
        check_item_icon(name, M.ITEM_DIR / f"{name}.png", vanilla)
    bp = check_pack_icon("BP pack_icon", M.BP_ICON)
    rp = check_pack_icon("RP pack_icon", M.RP_ICON)
    if bp is not None and rp is not None:
        check(not np.array_equal(bp, rp), "BP and RP pack icons are identical")
    check_fragment()
    check_up_to_date()
    if failures:
        for f in failures:
            print(f"FAIL {f}")
        print(f"{len(failures)} failure(s), {passes} checks passed")
        return 1
    print(f"OK: {passes} checks passed ({len(M.ICON_NAMES)} item icons, 2 pack icons, fragment; "
          f"compared against {len(vanilla)} vanilla 16x16 item textures)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
