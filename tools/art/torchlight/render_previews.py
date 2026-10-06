#!/usr/bin/env python3
"""Preview renders for the tactical torchlight attachable (tools/georender).

Outputs:
  docs/images/torchlight_model.png        model views, off and on texture
  docs/images/torchlight_hold.png         vanilla player model (geometry.humanoid.custom, neutral
                                          generated skin) holding the torch in the main hand and the
                                          off hand (third person), plus approximate first-person
                                          frames (20:9 screen, 70 deg vertical FOV)
  docs/images/torchlight_calibration.png  vanilla shield / trident / spyglass geometry (flat
                                          colours) placed with the same binding + first-person
                                          camera model, as a sanity check of the derivation

How the attachable is posed: the item geometry is re-parented to the holder's rightItem /
leftItem bone and shifted by (bone pivot - (0,24,0)) - exactly the binding rule derived in
hold.py - and the player animations (animation.player.holding, first_person.empty_hand, ...)
are read from the vanilla reference.  The torch animations and the variables in the
attachable's scripts.initialize are read from OUR generated files, and the scripts.animate
conditions are evaluated with c.is_first_person / c.item_slot, so the renders exercise the
shipped JSON.

The vanilla reference (env PAS_VANILLA_REF or the default path in tools/validate.py) supplies
geometry and animations only; no Mojang texture is used for anything written to docs/.
--vanilla-textures OUTDIR additionally writes scratch renders with the vanilla skin/shield/
trident textures into OUTDIR (never into the repository).

Usage: python3 tools/art/torchlight/render_previews.py [--vanilla-textures DIR]
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import hold  # noqa: E402
import torch_model as tm  # noqa: E402

sys.path.insert(0, str(tm.ROOT / "tools" / "georender"))
import georender as g  # noqa: E402

DEFAULT_REF = "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"
REF = Path(os.environ.get("PAS_VANILLA_REF") or DEFAULT_REF) / "resource_pack"
DOCS = tm.ROOT / "docs" / "images"
TEX_OFF = tm.ROOT / "addon" / "resource_pack" / "textures" / "entity" / "pas" / "tactical_torchlight.png"
TEX_ON = tm.ROOT / "addon" / "resource_pack" / "textures" / "entity" / "pas" / "tactical_torchlight_on.png"
BG = "#2b2d31"
SKY = (96, 128, 168)
GROUND = (74, 92, 60)


# ---------------------------------------------------------------------------
# inputs
# ---------------------------------------------------------------------------

def player_geometry() -> g.Geometry:
    return g.load_geometries(str(REF / "models" / "mobs.json")).get("geometry.humanoid.custom")


def vanilla_anims() -> g.AnimationLibrary:
    return g.load_animations(str(REF / "animations" / "player.animation.json"),
                             str(REF / "animations" / "player_firstperson.animation.json"),
                             str(REF / "animations" / "humanoid.animation.json"))


def our_anims() -> g.AnimationLibrary:
    return g.load_animations(str(hold.ANIM_PATH))


def attachable_desc(on: bool) -> dict:
    path = hold.ATT_ON if on else hold.ATT_OFF
    return json.loads(path.read_text())["minecraft:attachable"]["description"]


def neutral_skin() -> np.ndarray:
    """64x64 mannequin skin in the vanilla box-UV layout (original, flat colours).  Overlay
    regions (hat, jacket, sleeves, pants) stay transparent."""
    t = np.zeros((64, 64, 4), dtype=np.uint8)

    def box(u, v, w, h, d, col, hand=None):
        t[v:v + d + h, u:u + 2 * d + 2 * w] = (*col, 255)
        t[v:v + d, u:u + d] = 0
        t[v:v + d, u + d + 2 * w:u + 2 * d + 2 * w] = 0
        if hand:   # bottom texels of the arm + the down face
            t[v + d + h - 3:v + d + h, u:u + 2 * d + 2 * w] = (*hand, 255)
            t[v:v + d, u + d + w:u + d + 2 * w] = (*hand, 255)

    skin = (196, 170, 140)
    box(0, 0, 8, 8, 8, skin)                       # head
    t[8 + 3:8 + 5, 8 + 1:8 + 3] = (40, 44, 52, 255)   # eyes on the front face (u 8..16, v 8..16)
    t[8 + 3:8 + 5, 8 + 5:8 + 7] = (40, 44, 52, 255)
    box(16, 16, 8, 12, 4, (92, 124, 150))          # body / shirt
    box(40, 16, 4, 12, 4, (104, 138, 164), skin)   # right arm
    box(32, 48, 4, 12, 4, (104, 138, 164), skin)   # left arm
    box(0, 16, 4, 12, 4, (70, 76, 92))             # right leg
    box(16, 48, 4, 12, 4, (70, 76, 92))            # left leg
    return t


def load_png(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


# ---------------------------------------------------------------------------
# composition: attach item geometry to the holder's hand bone (binding rule from hold.py)
# ---------------------------------------------------------------------------

def attach(player: g.Geometry, item: g.Geometry, slot: str) -> g.Geometry:
    """Player skeleton (no cubes) + the item's bones re-parented onto rightItem/leftItem."""
    target = "rightItem" if slot == "main_hand" else "leftItem"
    tb = player.bone(target)
    delta = np.array(tb.pivot) - hold.BIND_ORIGIN
    geo = g.Geometry(identifier=item.identifier + "@" + target, texture_width=item.texture_width,
                     texture_height=item.texture_height, format_version=item.format_version)
    for b in player.bones:
        nb = copy.copy(b)
        nb.cubes = []
        geo.bones.append(nb)
    item_names = {b.key for b in item.bones}
    for b in item.bones:
        nb = copy.deepcopy(b)
        nb.pivot = tuple(np.array(b.pivot) + delta)
        for c in nb.cubes:
            c.origin = tuple(np.array(c.origin) + delta)
            if c.pivot is not None:
                c.pivot = tuple(np.array(c.pivot) + delta)
        if not b.parent or b.parent.lower() not in item_names:
            nb.parent = target          # root bone: bound to the hand bone
        geo.bones.append(nb)
    return geo


def default_bone_pivot(player: g.Geometry):
    def q(name, axis=0):
        b = player.bone(str(name))
        return float(b.pivot[int(axis)]) if b else 0.0
    return q


def molang_vars(lines: list[str]) -> dict:
    out = {}
    for ln in lines:
        m = re.match(r"\s*variable\.([a-z0-9_]+)\s*=\s*(-?[\d.]+)\s*;", ln)
        if m:
            out[m.group(1)] = float(m.group(2))
    return out


def item_plays(desc: dict, anims: g.AnimationLibrary, first_person: bool, slot: str) -> tuple[list, dict, dict]:
    """Plays chosen by evaluating the attachable's scripts.animate conditions."""
    ctx = {"is_first_person": 1.0 if first_person else 0.0, "item_slot": slot}
    variables = molang_vars(desc["scripts"]["initialize"])
    plays = []
    for entry in desc["scripts"]["animate"]:
        (key, cond), = entry.items() if isinstance(entry, dict) else ((entry, "1"),)
        w = g.Molang(cond).eval(g.frame_context(0.0, None, variables, ctx))
        if w:
            plays.append(g.Play(anims.get(desc["animations"][key])))
    assert len(plays) == 1, f"expected exactly one hold animation, got {len(plays)}"
    return plays, variables, ctx


def player_plays(van: g.AnimationLibrary, first_person: bool) -> list:
    if first_person:
        names = ["animation.player.first_person.base_pose", "animation.player.first_person.empty_hand"]
    else:
        names = ["animation.humanoid.base_pose", "animation.humanoid.look_at_target.default",
                 "animation.player.move.arms", "animation.player.move.legs", "animation.player.holding"]
    return [g.Play(van.get(n)) for n in names]


# ---------------------------------------------------------------------------
# cameras
# ---------------------------------------------------------------------------

FP_W, FP_H, FP_FOV = 640, 288, 70.0     # 20:9 like the target phone, vertical FOV


def fp_camera():
    d = 100.0
    target = (0.0, float(hold.EYE[1]), d)
    cam = g.Camera(yaw=0.0, pitch=0.0, fov=FP_FOV, distance=d, target=target)
    scale = (FP_H / 2) / math.tan(math.radians(FP_FOV / 2))
    fr = g.Framing(0.0, 0.0, scale, g.geo_to_rs(target), d)
    return cam, fr


def fp_background(label: str) -> Image.Image:
    img = Image.new("RGBA", (FP_W, FP_H), (*SKY, 255))
    dr = ImageDraw.Draw(img)
    dr.rectangle([0, FP_H // 2, FP_W, FP_H], fill=(*GROUND, 255))
    cx, cy = FP_W // 2, FP_H // 2
    dr.line([(cx - 6, cy), (cx + 6, cy)], fill=(255, 255, 255, 255), width=2)
    dr.line([(cx, cy - 6), (cx, cy + 6)], fill=(255, 255, 255, 255), width=2)
    if label:
        dr.text((6, 4), label, fill=(255, 255, 255, 255), font=g._font(13), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    return img


def over(bg: Image.Image, fg: Image.Image) -> Image.Image:
    out = bg.copy()
    out.alpha_composite(fg)
    return out


# ---------------------------------------------------------------------------
# renders
# ---------------------------------------------------------------------------

def item_layer(geo: g.Geometry, on: bool, tex: np.ndarray | None = None) -> g.Layer:
    lay = g.Layer(geo, tex if tex is not None else load_png(TEX_ON if on else TEX_OFF))
    return g.parse_layer_flags(lay, "material=spider" if on else "material=entity_alphatest")


def render_first_person(player, torch_geo, van, ours, slot: str, on: bool, label: str) -> Image.Image:
    desc = attachable_desc(on)
    plays_i, variables, ctx = item_plays(desc, ours, True, slot)
    geo = attach(player, torch_geo, slot)
    cam, fr = fp_camera()
    q = {"get_default_bone_pivot": default_bone_pivot(player)}
    img = g.render([item_layer(geo, on)], cam, size=(FP_W, FP_H), framing=fr, supersample=3,
                   plays=player_plays(van, True) + plays_i, queries=q, variables=variables, context=ctx)
    return over(fp_background(label), img)


def render_third_person(player, torch_geo, van, ours, skin, slot: str, on: bool, view: str, label: str,
                        size=(300, 360), zoom=1.0, target=None) -> Image.Image:
    desc = attachable_desc(on)
    plays_i, variables, ctx = item_plays(desc, ours, False, slot)
    variables = dict(variables, is_holding_right=1.0 if slot == "main_hand" else 0.0,
                     is_holding_left=1.0 if slot != "main_hand" else 0.0)
    geo = attach(player, torch_geo, slot)
    layers = [g.Layer(player, skin), item_layer(geo, on)]
    cam = g.Camera.view(view, zoom=zoom, target=target)
    return g.render(layers, cam, size=size, background=BG, supersample=3,
                    plays=player_plays(van, False) + plays_i, variables=variables, context=ctx, label=label)


def model_sheet() -> Image.Image:
    lib = g.load_geometries(str(tm.GEO_PATH))
    geo = lib.get(tm.GEO_ID)
    tiles = []
    for on in (False, True):
        lay = item_layer(geo, on)
        for view, lab in (("iso", "iso"), ("iso_back", "iso back"), ("right", "right side"), ("front", "front (lens)"), ("top", "top")):
            tiles.append((f"{'ON' if on else 'OFF'} {lab}", g.render([lay], g.Camera.view(view, ortho=view in ("right", "front", "top")),
                                                                  size=220, background=BG, supersample=3)))
    return g.contact_sheet(tiles, cols=5, title="geometry.pas.tactical_torchlight  (64x64 texture, 1 texel/unit, 11.5 units long)")


def hold_sheet(player, torch_geo, van, ours) -> Image.Image:
    skin = neutral_skin()
    rows = []
    tp = []
    hand_target = {"main_hand": (-6.0, 15.0, -3.0), "off_hand": (6.0, 15.0, -3.0)}
    for slot, nice in (("main_hand", "main hand"), ("off_hand", "off hand")):
        tp.append(render_third_person(player, torch_geo, van, ours, skin, slot, False, "iso", f"3rd person {nice}: iso"))
        tp.append(render_third_person(player, torch_geo, van, ours, skin, slot, True, "front", f"{nice}: front (ON)"))
        side = "right" if slot == "main_hand" else "left"
        tp.append(render_third_person(player, torch_geo, van, ours, skin, slot, False,
                                      side, f"{nice}: hand close-up", zoom=3.2, target=hand_target[slot]))
    rows.append(tp)
    fp = []
    for slot, nice in (("main_hand", "main hand"), ("off_hand", "off hand")):
        for on in (False, True):
            fp.append(render_first_person(player, torch_geo, van, ours, slot, on,
                                          f"1st person (approx.) {nice} {'ON' if on else 'OFF'}"))
    rows.append(fp)
    # assemble: 6 third-person tiles (2 rows of 3) + 4 first-person tiles (2 x 2)
    tw, th = tp[0].size
    fw, fh = fp[0].size
    pad = 8
    width = max(3 * tw + 4 * pad, 2 * fw + 3 * pad)
    height = 2 * th + 2 * fh + 6 * pad + 24
    sheet = Image.new("RGBA", (width, height), (32, 33, 36, 255))
    dr = ImageDraw.Draw(sheet)
    dr.text((pad, 4), "pas:tactical_torchlight held (vanilla geometry.humanoid.custom, neutral skin; "
            "binding q.item_slot_to_bone_name(c.item_slot))", fill=(230, 230, 230, 255), font=g._font(13))
    y = 24
    for r in range(2):
        for cidx in range(3):
            sheet.alpha_composite(tp[r * 3 + cidx] if False else tp[cidx + 3 * r], (pad + cidx * (tw + pad), y))
        y += th + pad
    for r in range(2):
        for cidx in range(2):
            sheet.alpha_composite(fp[r * 2 + cidx], (pad + cidx * (fw + pad), y))
        y += fh + pad
    return sheet


# --- calibration: vanilla items through the same binding + camera model (flat colours) ------

VANILLA_ITEMS = {
    # name: (geo file, geometry id, first-person (pos, rot) per slot, third-person (pos, rot, scale) per slot)
    "shield": ("shield.geo.json", "geometry.shield",
               {"main_hand": ((5.3, 26.0, 0.4), (91.0, 65.0, -43.0)), "off_hand": ((-13.5, -5.8, 5.1), (1.0, 176.0, -2.5))},
               {"main_hand": ((-0.4, 9.0, 9.3), (-90.0, 0.0, 90.0), (1, -1, -1)),
                "off_hand": ((-1.6, 9.0, 9.3), (-90.0, 0.0, 90.0), (-1, -1, 1))}),
    "trident": ("trident.geo.json", "geometry.trident",
                {"main_hand": ((-7.0, -3.0, -2.0), (152.0, -9.0, 25.0))},
                {"main_hand": ((1.5, -2.5, -10.5), (97.0, -1.5, -49.0), (1, 1, 1))}),
    "spyglass": ("spyglass.geo.json", "geometry.spyglass",
                 {"main_hand": ((2.0, 25.0, -1.0), (58.0, -48.0, -44.0))},
                 {"main_hand": ((1.0, 22.0, 0.0), (0.0, -90.0, 0.0), (1, 1, 1))}),
}


def static_anim(bone: str, pos, r, scale=(1, 1, 1)) -> g.Animation:
    return g.Animation.parse("calib", {"loop": True, "bones": {bone: {"position": list(pos), "rotation": list(r),
                                                                    "scale": list(scale)}}})


def calibration_sheet(player, van, textures: dict | None = None, tex_note: str = "flat colours") -> Image.Image:
    skin = neutral_skin()
    tiles = []
    cam, fr = fp_camera()
    q = {"get_default_bone_pivot": default_bone_pivot(player)}
    for name, (fname, gid, fp, tp) in VANILLA_ITEMS.items():
        item = g.load_geometries(str(REF / "models" / "entity" / fname)).get(gid)
        bone = item.bones[0].name
        tex = (textures or {}).get(name)
        for slot, (pos, r) in fp.items():
            geo = attach(player, item, slot)
            lay = g.Layer(geo, tex, face_colors=tex is None)
            img = g.render([lay], cam, size=(FP_W, FP_H), framing=fr, supersample=2,
                           plays=player_plays(van, True) + [g.Play(static_anim(bone, pos, r))], queries=q)
            tiles.append((f"{name} 1st person {slot}", over(fp_background(""), img)))
        for slot, (pos, r, s) in tp.items():
            geo = attach(player, item, slot)
            lay = g.Layer(geo, tex, face_colors=tex is None)
            variables = {"is_holding_right": 1.0 if slot == "main_hand" else 0.0,
                         "is_holding_left": 1.0 if slot != "main_hand" else 0.0}
            img = g.render([g.Layer(player, skin), lay], g.Camera.view("iso"), size=(FP_H, FP_H), background=BG,
                           supersample=2, plays=player_plays(van, False) + [g.Play(static_anim(bone, pos, r, s))],
                           variables=variables)
            tiles.append((f"{name} 3rd person {slot}", img))
    return g.contact_sheet(tiles, cols=3, title=f"vanilla attachables through the derived binding + camera model ({tex_note})")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--vanilla-textures", type=Path, help="scratch dir for renders that use vanilla textures (never the repo)")
    a = ap.parse_args(argv)
    if not (REF / "models" / "mobs.json").is_file():
        print(f"vanilla reference not found at {REF}; set PAS_VANILLA_REF", file=sys.stderr)
        return 1
    player = player_geometry()
    van = vanilla_anims()
    ours = our_anims()
    torch_geo = g.load_geometries(str(tm.GEO_PATH)).get(tm.GEO_ID)
    DOCS.mkdir(parents=True, exist_ok=True)
    out = {
        DOCS / "torchlight_model.png": model_sheet(),
        DOCS / "torchlight_hold.png": hold_sheet(player, torch_geo, van, ours),
        DOCS / "torchlight_calibration.png": calibration_sheet(player, van),
    }
    for p, img in out.items():
        img.save(p, format="PNG", optimize=True)
        print(f"wrote {p.relative_to(tm.ROOT)} {img.size[0]}x{img.size[1]}")
    if a.vanilla_textures:
        root = a.vanilla_textures.resolve()
        if str(root).startswith(str(tm.ROOT.resolve())):
            print("refusing to write vanilla-texture renders inside the repository", file=sys.stderr)
            return 1
        root.mkdir(parents=True, exist_ok=True)
        texs = {n: g.load_texture(f"textures/entity/{n}", roots=[str(REF)]) for n in ("shield", "trident")}
        texs["spyglass"] = g.load_texture("textures/entity/spyglass", roots=[str(REF)])
        calibration_sheet(player, van, texs, "vanilla textures, scratch only").save(root / "calibration_vanilla.png")
        print(f"wrote {root / 'calibration_vanilla.png'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
