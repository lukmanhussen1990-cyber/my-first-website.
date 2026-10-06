#!/usr/bin/env python3
"""Generate the original item icons and pack icons for Parasite Apocalypse Survival.

Everything written by this script is original art, drawn here from hand-authored
pixel grids (16x16 item icons) or procedurally (256x256 pack icons). No Mojang
texture is read or copied.

Outputs (paths relative to the repository root):
  addon/resource_pack/textures/items/pas/pas_torchlight_off.png
  addon/resource_pack/textures/items/pas/pas_torchlight_on.png
  addon/resource_pack/textures/items/pas/pas_base_spawner.png
  addon/resource_pack/textures/items/pas/pas_outbreak.png
  addon/resource_pack/textures/items/pas/pas_control.png
  addon/fragments/item_texture/items.json
  addon/behavior_pack/pack_icon.png
  addon/resource_pack/pack_icon.png
  docs/images/icons_preview.png

Usage: python3 tools/icons/make_icons.py [--preview-only]
Deterministic: the same script always produces byte-identical PNGs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

sys.dont_write_bytecode = True  # keep tools/icons free of __pycache__
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pack_icon import make_pack_icon  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
ITEM_DIR = ROOT / "addon" / "resource_pack" / "textures" / "items" / "pas"
FRAGMENT = ROOT / "addon" / "fragments" / "item_texture" / "items.json"
BP_ICON = ROOT / "addon" / "behavior_pack" / "pack_icon.png"
RP_ICON = ROOT / "addon" / "resource_pack" / "pack_icon.png"
PREVIEW = ROOT / "docs" / "images" / "icons_preview.png"

# short name (SPEC §3) -> file stem under textures/items/pas/
ICON_NAMES = (
    "pas_torchlight_off",
    "pas_torchlight_on",
    "pas_base_spawner",
    "pas_outbreak",
    "pas_control",
)


def hexc(s: str, a: int = 255) -> tuple[int, int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), a)


def grid_image(rows: list[str], palette: dict[str, str]) -> Image.Image:
    """Turn a list of equal-length strings into an RGBA image. '.' is transparent."""
    h = len(rows)
    w = len(rows[0])
    assert all(len(r) == w for r in rows), "ragged grid"
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            if ch not in palette:
                raise KeyError(f"palette has no entry for {ch!r} (row {y}, col {x})")
            px[x, y] = hexc(palette[ch])
    return img


# ---------------------------------------------------------------------------
# 16x16 item icons. Light comes from the top-left; every shape has a 1-px dark
# outline. Grids are 16 rows of 16 characters.
# ---------------------------------------------------------------------------

# Tactical torchlight, drawn diagonally like vanilla tools: tail bottom-left,
# head and lens top-right. The same grid is used for both states; only the
# lens palette and the flare pixels change.
TORCH_GRID = [
    "...........KK...",
    "..........KRRK..",
    ".........KRWGRK.",
    "........KBBRggQK",
    ".......KBBbbQghK",
    ".......KBbbbdQK.",
    "......KBbbbddK..",
    "......KLbbddK...",
    ".....KsSDdKK....",
    "....KLMDKK......",
    "...KMrDK........",
    "..KLMrK.........",
    ".KMrDK..........",
    "KMMrK...........",
    "KDdK............",
    ".KK.............",
]

TORCH_BODY = {
    "K": "#121418",  # outline
    "L": "#6b7480",  # lit edge of the body
    "M": "#4a515b",  # body
    "D": "#31363e",  # shaded edge
    "r": "#22262c",  # grip ribbing groove
    "s": "#c0392b",  # tail switch
    "S": "#e2604c",  # switch highlight
    "B": "#5a626d",  # head shell, lit
    "b": "#434a53",  # head shell
    "d": "#2b3037",  # head shell, shaded
    "R": "#b3bbc4",  # bezel ring
    "Q": "#717a85",  # bezel ring, shaded
}
TORCH_LENS_OFF = {
    "W": "#c4ccd3",  # glint
    "G": "#8f9ba5",
    "g": "#6b7781",
    "h": "#525c66",
    "F": "#000000",  # flare (unused when off)
    "f": "#000000",
}
TORCH_LENS_ON = {
    "W": "#ffffff",
    "G": "#fff7d4",
    "g": "#ffe79a",
    "h": "#ffc94f",
    "F": "#fff6d0",  # flare core
    "f": "#ffd25e",  # flare rays
}
# Flare pixels drawn on top of the torch grid for the ON state ('.' = keep).
TORCH_FLARE = [
    ".............f..",
    "..............F.",
    "...............f",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
]


def overlay(rows: list[str], over: list[str]) -> list[str]:
    out = []
    for r, o in zip(rows, over):
        out.append("".join(oc if oc != "." else rc for rc, oc in zip(r, o)))
    return out


def icon_torch(on: bool) -> Image.Image:
    pal = dict(TORCH_BODY)
    pal.update(TORCH_LENS_ON if on else TORCH_LENS_OFF)
    rows = overlay(TORCH_GRID, TORCH_FLARE) if on else TORCH_GRID
    return grid_image(rows, pal)


HOUSE_GRID = [
    ".......KK.......",
    "......KoOK......",
    ".....KooOPK.....",
    "....KoocCOPK....",
    "...KooOCvOOPK...",
    "..KooOOOOOOPPK..",
    ".KooOOOOOOOOPPK.",
    "KyYYYYYYYYYYYYZK",
    ".KwqqqqqqqqqqQK.",
    ".KwPPPPPwPPPPQK.",
    ".KwPcCCPwPoOPQK.",
    ".KwPCCvPwPoyPQK.",
    ".KwPPPPPwPoOPQK.",
    "KyYYYYYYYYYYYYZK",
    "KZZZZZZZZZZZZZZK",
    ".KKKKKKKKKKKKKK.",
]
HOUSE_PAL = {
    "K": "#1d150e",  # outline
    "o": "#5a3d22",  # dark oak, lit
    "O": "#432c18",  # dark oak
    "P": "#2e1e10",  # dark oak, shaded / frames
    "w": "#fbf8f2",  # quartz, lit
    "q": "#e6e0d5",  # quartz
    "Q": "#c5bcae",  # quartz, shaded
    "c": "#e4f7ff",  # glass glint
    "C": "#9ed4ee",  # glass
    "v": "#5f9fc4",  # glass, deep
    "y": "#fff08a",  # gold highlight
    "Y": "#f0c23c",  # gold
    "Z": "#b2801e",  # gold, shaded
}

JAR_GRID = [
    "................",
    "...KKKKKKKKKK...",
    "...KaaaaaaaAK...",
    "...KsssssssSK...",
    "...KeggggggEK...",
    "..KennnnnnnnEK..",
    "..KewLhhhHLmEK..",
    "..KeRLWhhWLREK..",
    "..KewRhMMHRmEK..",
    "..KeloHMMHLmEK..",
    "..KeRRrrbrRREK..",
    "..KelLrbrromEK..",
    "..KelRLRRLRmEK..",
    "..KeRLLLLLLREK..",
    "..KeEEEEEEEEEK..",
    "...KKKKKKKKKK...",
]
JAR_PAL = {
    "K": "#16222a",  # outline
    "a": "#aab2ba",  # lid steel, lit
    "A": "#6f7881",  # lid steel, shaded
    "s": "#c03a2e",  # red seal band
    "S": "#7f1d16",  # red seal band, shaded
    "e": "#c2e2ec",  # glass wall, lit
    "E": "#7397a6",  # glass wall, shaded
    "g": "#a6cfdc",  # glass neck / air gap
    "w": "#e3f6f2",  # glass glint over liquid
    "n": "#86c8bc",  # meniscus
    "l": "#55a094",  # preservative fluid, lit
    "L": "#3d8479",  # preservative fluid
    "m": "#2a6158",  # preservative fluid, shaded
    "o": "#b5e6dd",  # bubble
    "h": "#e2b6a0",  # parasite head, pale
    "H": "#b8806b",  # parasite head, shaded
    "W": "#ffffff",  # eyes
    "M": "#4a0707",  # mouth
    "r": "#b3271d",  # crimson body
    "R": "#741612",  # crimson, dark (legs)
    "b": "#5c2716",  # brown mottling
}

TABLET_GRID = [
    "............K...",
    "...........KtK..",
    "KKKKKKKKKKKKKKK.",
    "KyyCCCCCCCCCyYK.",
    "KyeeeeXeXeeeeYK.",
    "KCEEEXEEEXEEEdK.",
    "KCeeeXeXeXeeedK.",
    "KCEEEEXXXEEEEdK.",
    "KCeeXXXeXXXeedK.",
    "KCEXEEXEXEEXEdK.",
    "KCeXeeXXXeeXedK.",
    "KCEEXXEEEXXEEdK.",
    "KCcccccccccccdK.",
    "KCcrcocgcbcbcdK.",
    "KyydddddddddYYK.",
    ".KKKKKKKKKKKKK..",
]
TABLET_PAL = {
    "K": "#15171a",  # outline
    "C": "#687160",  # olive casing, lit
    "c": "#4b5243",  # olive casing
    "d": "#30352b",  # olive casing, shaded
    "y": "#f2a93b",  # rubber corner bumper
    "Y": "#b8711a",  # rubber corner bumper, shaded
    "e": "#1c0707",  # screen
    "E": "#250909",  # screen scanline
    "X": "#ff3b2e",  # biohazard symbol
    "r": "#e0392b",  # red button
    "o": "#f6c544",  # amber button
    "g": "#4cc653",  # green button
    "b": "#a3a99c",  # grey buttons
    "t": "#ff5243",  # status LED
}


def make_item_icons() -> dict[str, Image.Image]:
    return {
        "pas_torchlight_off": icon_torch(False),
        "pas_torchlight_on": icon_torch(True),
        "pas_base_spawner": grid_image(HOUSE_GRID, HOUSE_PAL),
        "pas_outbreak": grid_image(JAR_GRID, JAR_PAL),
        "pas_control": grid_image(TABLET_GRID, TABLET_PAL),
    }


# ---------------------------------------------------------------------------
# Preview sheet
# ---------------------------------------------------------------------------

def make_preview(icons: dict[str, Image.Image], pack: list[Image.Image]) -> Image.Image:
    scale = 8
    cell = 16 * scale
    pad = 16
    n = len(icons)
    strip_w = n * (cell + pad) + pad
    strip_h = cell + 2 * pad
    pack_size = 256
    width = max(strip_w, len(pack) * (pack_size + pad) + pad)
    height = 2 * strip_h + pack_size + 2 * pad
    sheet = Image.new("RGBA", (width, height), hexc("#808080"))
    bgs = [hexc("#e8e4dc"), hexc("#26262b")]
    for row, bg in enumerate(bgs):
        y0 = row * strip_h
        sheet.paste(Image.new("RGBA", (width, strip_h), bg), (0, y0))
        for i, name in enumerate(ICON_NAMES):
            big = icons[name].resize((cell, cell), Image.NEAREST)
            sheet.alpha_composite(big, (pad + i * (cell + pad), y0 + pad))
    y0 = 2 * strip_h + pad
    for i, im in enumerate(pack):
        sheet.alpha_composite(im, (pad + i * (pack_size + pad), y0))
    return sheet


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def main(argv: list[str]) -> int:
    icons = make_item_icons()
    pack = [make_pack_icon("bp"), make_pack_icon("rp", icons["pas_torchlight_on"])]
    preview_only = "--preview-only" in argv
    if not preview_only:
        for name, img in icons.items():
            save_png(img, ITEM_DIR / f"{name}.png")
        save_png(pack[0], BP_ICON)
        save_png(pack[1], RP_ICON)
        FRAGMENT.parent.mkdir(parents=True, exist_ok=True)
        frag = {name: {"textures": f"textures/items/pas/{name}"} for name in ICON_NAMES}
        FRAGMENT.write_text(json.dumps(frag, indent=2) + "\n", encoding="utf-8")
    save_png(make_preview(icons, pack), PREVIEW)
    what = "preview" if preview_only else f"{len(icons)} item icons, item_texture fragment, 2 pack icons, preview"
    print(f"wrote {what} -> {PREVIEW.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
