#!/usr/bin/env python3
"""Paint the original textures for the tactical torchlight held-item model.

Outputs (64x64, 1 texel per model unit, UV layout from torch_model.atlas()):
  addon/resource_pack/textures/entity/pas/tactical_torchlight.png      off: grey lens
  addon/resource_pack/textures/entity/pas/tactical_torchlight_on.png   on:  warm-white lens

Palette = the 2D item icon palette (tools/icons/make_icons.py): gunmetal body with grip
ribbing, red switch band, silver knurled bezel.  Every texel is computed here from the model
spec; no Mojang texture is read or copied.

Alpha:
  * off texture: every used texel alpha 255 (material entity_alphatest).
  * on texture:  alpha is an EMISSIVE MASK for the vanilla "spider" material (the spider
    texture in bedrock-samples 1.21.0.26 marks its glowing eye texels with alpha 3 and
    everything else 255).  Lens texels get alpha 3 (full-bright), the reflector walls of the
    bezel recess alpha 120 (half-lit), everything else 255 (normally lit).

Usage: python3 tools/art/torchlight/make_torch_texture.py [--debug-uv OUT.png]
Deterministic: the same script always writes byte-identical PNGs.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import torch_model as tm  # noqa: E402

TEX_DIR = tm.ROOT / "addon" / "resource_pack" / "textures" / "entity" / "pas"
OUT_OFF = TEX_DIR / "tactical_torchlight.png"
OUT_ON = TEX_DIR / "tactical_torchlight_on.png"


def hexc(s: str) -> tuple[int, int, int]:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


# Icon palette (tools/icons/make_icons.py TORCH_BODY / TORCH_LENS_*).  The gunmetal tones are
# lifted one step for the 3D model because the game darkens side faces (x0.6-0.8) and bottoms
# (x0.5); the icon's own darkest tones are kept for grooves and the switch/bezel colours are
# unchanged.
P = {k: hexc(v) for k, v in {
    "K": "#1c1f24",  # deepest groove (icon K #121418, lifted)
    "L": "#808a96",  # lit body (icon L #6b7480, lifted)
    "M": "#636b77",  # body (icon M #4a515b, lifted)
    "D": "#474e58",  # shaded body (icon D #31363e, lifted)
    "r": "#30353c",  # grip ribbing groove (icon r #22262c, lifted)
    "s": "#c0392b",  # switch red (icon)
    "S": "#e2604c",  # switch highlight (icon)
    "x": "#8e271d",  # switch red, shaded
    "y": "#a8322a",  # switch red, edge
    "B": "#737c88",  # head shell, lit (icon B #5a626d, lifted)
    "b": "#5b636e",  # head shell (icon b #434a53, lifted)
    "d": "#3f454e",  # head shell, shaded (icon d #2b3037, lifted)
    "R": "#b3bbc4",  # bezel ring (icon)
    "Q": "#717a85",  # bezel ring, shaded (icon)
    "c": "#9aa3ae",  # clip steel, lit
    "F": "#d9dfe5",  # polished reflector
}.items()}
LENS_OFF = {k: hexc(v) for k, v in {"W": "#c4ccd3", "G": "#8f9ba5", "g": "#6b7781", "h": "#525c66"}.items()}
LENS_ON = {k: hexc(v) for k, v in {"W": "#ffffff", "G": "#fff7d4", "g": "#ffe79a", "h": "#ffc94f"}.items()}
REFLECT_ON = hexc("#ffe2a0")     # warm light on the bezel recess walls when on

EMISSIVE_LENS_ALPHA = 3          # same value vanilla uses for spider eyes
EMISSIVE_REFLECTOR_ALPHA = 120   # partially lit


def _edge(frac: float, n: int) -> bool:
    """True when the texel at fraction ``frac`` across ``n`` texels is an edge texel."""
    idx = min(n - 1, int(frac * n))
    return n >= 3 and (idx == 0 or idx == n - 1)


def paint_texel(part: tm.Part, face: str, a: float, b: float, i: int, j: int, cw: int, ch: int,
                on: bool) -> tuple[tuple[int, int, int], int]:
    """Colour + alpha of one texel.  (a, b) = face fractions of the texel centre, (i, j) = texel
    index inside the face cell of cw x ch texels."""
    x, y, L = tm.to_local(tm.face_point(part, face, a, b))
    side = face in ("east", "west", "up", "down")
    # across-the-face position for side faces (cylinder-like shading), texel count across
    if face in ("east", "west"):
        across, n_across, along_idx = b, ch, i
    elif face in ("up", "down"):
        across, n_across, along_idx = a, cw, j
    else:
        across, n_across, along_idx = a, cw, i
    edge = side and _edge(across, n_across)
    top, bottom = face == "up", face == "down"
    st = part.style
    lens = LENS_ON if on else LENS_OFF
    A = 255

    def tone(lit: str, mid: str, dark: str) -> tuple[int, int, int]:
        if bottom:
            return P[dark]
        if edge:
            return P[dark] if not top else P[mid]
        return P[lit] if top else P[mid]

    if st == "button":
        if face == "south":          # the rubber cap you press (faces the tail / the camera in 1st person)
            col = P["S"] if (i == 0 and j == 0) else (P["x"] if (i == 1 and j == 1) else P["s"])
        else:
            col = P["s"] if top else P["x"]
    elif st == "cap":
        if face == "south":          # rear face: rim around the switch boot
            rim = i in (0, cw - 1) or j in (0, ch - 1)
            corner = i in (0, cw - 1) and j in (0, ch - 1)
            col = P["D"] if corner else (P["L"] if (rim and j == 0) else (P["M"] if rim else P["r"]))
        elif face == "north":
            col = P["D"]
        else:
            rear = L < 1.0
            mid_across = 0.25 < across < 0.75
            if rear and mid_across:
                col = P["r"]         # scalloped cut-outs in the tail cap
            elif rear:
                col = P["L"] if top else (P["D"] if bottom else P["M"])
            else:                    # knurled ring
                k = (int(across * n_across) + along_idx) % 2
                col = (P["L"] if top else P["M"]) if k == 0 else P["D"]
                if bottom:
                    col = P["D"] if k == 0 else P["K"]
    elif st == "band":
        if side:
            if top:
                col = P["S"] if not edge else P["s"]
            elif bottom:
                col = P["x"]
            else:
                col = P["y"] if edge else P["s"]
        else:
            col = P["x"]
    elif st == "grip":                # core between the raised ribs = ribbing grooves
        col = P["r"] if not top else P["D"]
        if bottom:
            col = P["K"]
    elif st == "rib":
        if side:
            col = tone("L", "M", "D")
        else:
            col = P["D"]
    elif st == "collar":
        col = tone("B", "b", "d") if side else P["b"]
    elif st == "head":
        if side:                     # longitudinal flutes: ridge / groove across the face
            k = int(across * n_across)
            flute = k % 2 == 1
            if bottom:
                col = P["d"]
            elif flute:
                col = P["d"]
            else:
                col = P["B"] if top else P["b"]
        elif face == "south":        # rear lip of the head around the collar
            col = P["b"] if j < ch / 2 else P["d"]
        else:
            col = P["d"]
    elif st == "bezel":
        # which faces of a bar look into the lens opening
        inner = (
            (part.name == "bezel_top" and face == "down")
            or (part.name == "bezel_bottom" and face == "up")
            or (part.name == "bezel_left" and face == "east")
            or (part.name == "bezel_right" and face == "west")
        )
        hidden_side = (
            (part.name in ("bezel_left", "bezel_right") and face in ("up", "down"))
        )
        if inner:
            col = REFLECT_ON if on else P["F"]
            if on:
                A = EMISSIVE_REFLECTOR_ALPHA
        elif hidden_side:
            col = P["Q"]
        elif face == "north":        # front of the strike bezel: silver with shaded notches
            n_ring = cw if part.name in ("bezel_top", "bezel_bottom") else ch
            k = i if part.name in ("bezel_top", "bezel_bottom") else j
            notch = n_ring >= 6 and k in (0, n_ring - 1)
            col = P["Q"] if notch else P["R"]
        elif face == "south":
            col = P["Q"] if not bottom else P["d"]
        else:                        # outer knurled ring
            k = (int(across * n_across) + along_idx) % 2
            if bottom:
                col = P["Q"] if k == 0 else P["d"]
            else:
                col = (P["R"] if k == 0 else P["Q"])
    elif st == "lens":
        if face == "north":
            ii, jj = min(i, 3), min(j, 3)
            centre = ii in (1, 2) and jj in (1, 2)
            corner = ii in (0, 3) and jj in (0, 3)
            if on:
                col = lens["W"] if centre else (lens["g"] if corner else lens["G"])
            else:
                if ii == 0 and jj == 0:
                    col = lens["W"]          # glint
                elif centre:
                    col = lens["h"] if (ii, jj) != (1, 1) else lens["g"]
                elif corner:
                    col = lens["g"]
                else:
                    col = lens["G"]
        else:
            col = lens["h"]
        if on:
            A = EMISSIVE_LENS_ALPHA
    elif st == "clip":
        col = P["c"] if top else (P["M"] if not bottom else P["D"])
        if top and (L < 2.6 or L > 6.1):
            col = P["L"]
    elif st == "clip_dark":
        col = P["D"] if not top else P["M"]
    elif st == "ring":
        col = P["R"] if (top or face in ("east", "west")) and not bottom else P["Q"]
    else:
        raise ValueError(f"unknown style {st}")
    return col, A


def paint(on: bool) -> Image.Image:
    rgba = np.zeros((tm.TEX_H, tm.TEX_W, 4), dtype=np.uint8)
    filled = np.zeros((tm.TEX_H, tm.TEX_W), dtype=bool)
    for c in tm.atlas():
        for j in range(c.ch):
            lo_v, hi_v = j, min(j + 1.0, c.h)
            b = ((lo_v + hi_v) / 2) / c.h
            for i in range(c.cw):
                lo_u, hi_u = i, min(i + 1.0, c.w)
                a = ((lo_u + hi_u) / 2) / c.w
                col, alpha = paint_texel(c.part, c.face, a, b, i, j, c.cw, c.ch, on)
                rgba[c.v + j, c.u + i] = (*col, alpha)
                filled[c.v + j, c.u + i] = True
    # dilate every cell by one texel into the gutter so edge sampling never hits a hole
    out = rgba.copy()
    H, W = filled.shape
    for yy in range(H):
        for xx in range(W):
            if filled[yy, xx]:
                continue
            for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                sy, sx = yy + dy, xx + dx
                if 0 <= sy < H and 0 <= sx < W and filled[sy, sx]:
                    out[yy, xx] = rgba[sy, sx]
                    break
    return Image.fromarray(out, "RGBA")


def debug_uv(path: Path) -> None:
    """Texture where every face is a flat colour by face name + a darker texel at its UV origin
    (use with georender to check face orientation)."""
    cols = {"north": (220, 60, 60), "south": (60, 200, 60), "east": (60, 90, 230),
            "west": (230, 200, 40), "up": (240, 240, 240), "down": (90, 90, 90)}
    rgba = np.zeros((tm.TEX_H, tm.TEX_W, 4), dtype=np.uint8)
    for c in tm.atlas():
        rgba[c.v:c.v + c.ch, c.u:c.u + c.cw] = (*cols[c.face], 255)
        rgba[c.v, c.u] = (0, 0, 0, 255)
    Image.fromarray(rgba, "RGBA").save(path)


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--debug-uv", type=Path, help="also write a face-orientation debug texture here")
    a = ap.parse_args(argv)
    save_png(paint(False), OUT_OFF)
    save_png(paint(True), OUT_ON)
    print(f"wrote {OUT_OFF.relative_to(tm.ROOT)} and {OUT_ON.relative_to(tm.ROOT)}")
    if a.debug_uv:
        debug_uv(a.debug_uv)
        print(f"wrote {a.debug_uv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
