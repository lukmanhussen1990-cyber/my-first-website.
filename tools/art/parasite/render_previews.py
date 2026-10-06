#!/usr/bin/env python3
"""Preview renders of pas:parasite with tools/georender (offline, no game).

Repo images (our own texture only):
  docs/images/parasite_views.png          front / 3/4 / side / back / top / 3/4-left
  docs/images/parasite_walk.png           crawl cycle, side and 3/4 rows
  docs/images/parasite_attack.png         lunge, side and 3/4 rows
  docs/images/parasite_poses.png          idle twitch, hunting stance, hurt flinch, death curl, invisible
  docs/images/parasite_vs_reference.png   reference crop | preview | night simulation (emissive eyes)
  docs/images/parasite_uv.png             texture with every face's UV rect (painting aid)
  docs/images/parasite_scale.png          side view with 1-block lines, player and collision boxes
Scratchpad only (contains vanilla textures):
  <scratch>/parasite_scale.png            next to vanilla zombie and player models
  <scratch>/parasite_walk.gif, parasite_attack.gif

Usage: python3 tools/art/parasite/render_previews.py [--scratch DIR] [--reference PNG]
"""
from __future__ import annotations

import argparse
import copy
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent.parent
sys.path.insert(0, str(ROOT / "tools" / "georender"))
import georender as g  # noqa: E402

RP = ROOT / "addon" / "resource_pack"
DOCS = ROOT / "docs" / "images"
DEFAULT_REF = Path(os.environ.get(
    "PAS_VANILLA_REF",
    "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26"))
DEFAULT_SCRATCH = Path("/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/work")
DEFAULT_REFERENCE_IMG = Path("/root/.claude/uploads/6f33ccbb-4073-57f5-b83c-87aab56fa441/e76a04c2-image.png")
REFERENCE_CROP = (585, 375, 1045, 715)       # creature region of the user's screenshot (x0, y0, x1, y1)

WALK_Q = {"modified_distance_moved": "t*14", "modified_move_speed": 0.7}
LOOK_Q = {"target_y_rotation": 0.0, "target_x_rotation": 0.0}


def our_pack():
    roots = [str(RP)]
    if (DEFAULT_REF / "resource_pack").is_dir():
        roots.append(str(DEFAULT_REF / "resource_pack"))
    return g.ResourcePack(roots)


def entity(rp, queries=None, variables=None, time=0.0):
    layers, plays, vars_out, notes = g.entity_layers(rp, "pas:parasite", queries=queries, variables=variables, time=time)
    return layers, plays, vars_out


def label(img, text, size=13):
    dr = ImageDraw.Draw(img)
    dr.text((6, 4), text, fill=(255, 255, 255, 255), font=g._font(size), stroke_width=2, stroke_fill=(0, 0, 0, 255))
    return img


def emissive_mask_layers(layers):
    """Copies of the layers whose texture is white where the texture alpha marks
    emissive texels (alpha < 128) and black elsewhere."""
    out = []
    for lay in layers:
        m = copy.copy(lay)
        tex = lay.texture.copy()
        e = tex[..., 3] < 128
        tex[..., :3] = 0
        tex[e, :3] = 255
        tex[..., 3] = 255
        m.texture = tex
        m.emissive_alpha = False
        m.alpha_test = False
        m.bone_flags = {}
        out.append(m)
    return out


def night(layers, cam, size, plays, queries, variables, time, bg=(14, 18, 12, 255), light=0.42):
    """Crude stand-in for the in-game night look: the lit preview darkened to
    `light`, emissive texels kept at full brightness, plus a soft bloom.
    Bloom is NOT something RenderDragon on the target device does for entities."""
    info = {}
    base = g.render(layers, cam, size=size, plays=plays, time=time, queries=queries, variables=variables, info=info)
    mask = g.render(emissive_mask_layers(layers), cam, size=size, plays=plays, time=time, queries=queries,
                    variables=variables, framing=info["framing"], shading=False)
    b = np.asarray(base).astype(float)
    m = np.asarray(mask).astype(float)[..., 0:1] / 255.0 * (np.asarray(mask)[..., 3:4] / 255.0)
    rgb = b[..., :3] * (light + (1 - light) * m)
    out = np.zeros_like(b)
    bgc = np.array(bg, dtype=float)
    a = b[..., 3:4] / 255.0
    out[..., :3] = rgb * a + bgc[:3] * (1 - a)
    glow = Image.fromarray((m[..., 0] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(size[0] / 90))
    gl = np.asarray(glow).astype(float)[..., None] / 255.0
    out[..., :3] = np.clip(out[..., :3] + gl * np.array([255, 150, 140]) * 0.7, 0, 255)
    out[..., 3] = 255
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def views(rp, out):
    layers, plays, v = entity(rp, queries=LOOK_Q)
    items = []
    for name in ("front", "iso", "right", "back", "top", "iso_left"):
        cam = g.Camera.view(name, ortho=name in ("front", "right", "back", "top"))
        items.append((name, g.render(layers, cam, size=360, plays=plays, variables=v, ground=True, queries=LOOK_Q)))
    sheet = g.contact_sheet(items, cols=3, title="pas:parasite - views (georender preview, ground squares = 1 block)")
    sheet.save(out)
    print("wrote", out)


def frames_sheet(rp, out, times, queries, variables, title, gif=None):
    layers, plays, v = entity(rp, queries=queries, variables=variables)
    rows = []
    for cam in (g.Camera.view("right", ortho=True), g.Camera.view("top", ortho=True), g.Camera(yaw=35, pitch=20)):
        rows += g.render_frames(layers, times, cam, size=210, plays=plays, queries=queries, variables=v, ground=True)
    sheet = g.contact_sheet(rows, cols=len(times), title=title)
    sheet.save(out)
    print("wrote", out)
    if gif:
        fr = g.render_frames(layers, list(np.linspace(times[0], times[-1], 16)), g.Camera(yaw=35, pitch=20), size=320,
                             plays=plays, queries=queries, variables=v, ground=True)
        g.save_gif([im for _, im in fr], str(gif), fps=12)
        print("wrote", gif)


def poses(rp, out):
    items = []
    cam = g.Camera(yaw=35, pitch=20)
    # idle twitch at its peak (variable.pas_twitch = 1)
    l, p, v = entity(rp, queries=LOOK_Q)
    v = dict(v)
    v["pas_twitch"] = 1.0
    items.append(("idle: head twitch", g.render(l, cam, size=300, plays=p, variables=v, queries=dict(LOOK_Q, life_time=0.93), ground=True)))
    l, p, v = entity(rp, queries=dict(LOOK_Q, has_target=1))
    items.append(("hunting stance (has_target)", g.render(l, cam, size=300, plays=p, variables=v, queries=dict(LOOK_Q, has_target=1), ground=True)))
    q = dict(LOOK_Q, hurt_time=10)
    l, p, v = entity(rp, queries=q)
    items.append(("hurt flinch (hurt_time 10)", g.render(l, cam, size=300, plays=p, variables=v, queries=q, ground=True)))
    q = {"is_alive": 0}
    l, p, v = entity(rp, queries=q)
    items.append(("death curl (+ engine death roll in game)", g.render(l, cam, size=300, plays=p, variables=v, queries=q, time=1.0, ground=True)))
    q = dict(LOOK_Q, is_invisible=1)
    l, p, v = entity(rp, queries=q)
    for lay in l:   # spider_invisible: only the emissive texels are drawn
        tex = lay.texture.copy()
        tex[tex[..., 3] >= 128, 3] = 0
        tex[tex[..., 3] > 0, 3] = 255
        lay.texture = tex
        lay.bone_flags = {}
        lay.alpha_test = True
        lay.emissive_alpha = False
    items.append(("invisible (spider_invisible: eyes only)", g.render(l, cam, size=300, plays=p, variables=v, queries=q, ground=True)))
    sheet = g.contact_sheet(items, cols=5, title="pas:parasite - state poses")
    sheet.save(out)
    print("wrote", out)


def comparison(rp, out, reference):
    W, H = 460, 340
    cam = g.Camera(yaw=24, pitch=27, fov=50)
    q = dict(LOOK_Q, has_target=1)
    layers, plays, v = entity(rp, queries=q)
    prev = g.render(layers, cam, size=(W, H), plays=plays, variables=v, queries=q, background="1d2416")
    nt = night(layers, cam, (W, H), plays, q, v, 0.0)
    panels = []
    if reference and Path(reference).is_file():
        ref = Image.open(reference).convert("RGBA").crop(REFERENCE_CROP).resize((W, H), Image.LANCZOS)
        panels.append(label(ref, "reference (user screenshot, shaders)"))
    panels.append(label(prev.convert("RGBA"), "pas:parasite - flat preview"))
    panels.append(label(nt, "night simulation: eyes emissive (alpha 3)"))
    sheet = Image.new("RGBA", (len(panels) * W + (len(panels) + 1) * 6, H + 12), (24, 24, 24, 255))
    for i, im in enumerate(panels):
        sheet.alpha_composite(im, (6 + i * (W + 6), 6))
    sheet.save(out)
    print("wrote", out)


def scale_check(rp_ours, out):
    """Side-by-side at one fixed scale with vanilla zombie and player (scratchpad only)."""
    rp_v = g.ResourcePack([str(DEFAULT_REF / "resource_pack")])
    cam = g.Camera(yaw=60, pitch=8, ortho=True, ppu=9.0, target=(0, 16, 0))
    panels = []
    for ident, rp, w in (("pas:parasite", rp_ours, 440), ("minecraft:zombie", rp_v, 200), ("minecraft:player", rp_v, 200)):
        try:
            layers, plays, v, _ = g.entity_layers(rp, ident)
        except KeyError:
            continue
        im = g.render(layers, cam, size=(w, 380), plays=plays, variables=v, ground=True, background="2a2a2a")
        panels.append(label(im, ident))
    sheet = Image.new("RGBA", (sum(p.size[0] for p in panels) + 6 * (len(panels) + 1), 392), (20, 20, 20, 255))
    x = 6
    for p in panels:
        sheet.alpha_composite(p, (x, 6))
        x += p.size[0] + 6
    dr = ImageDraw.Draw(sheet)
    y_ground = 6 + 380 / 2 + 16 * 9.0 * np.cos(np.radians(8))   # approx ground line
    for k in range(3):
        y = y_ground - k * 16 * 9.0 * np.cos(np.radians(8))
        dr.line([(0, y), (sheet.size[0], y)], fill=(90, 160, 255, 160))
    sheet.save(out)
    print("wrote", out)


def uv_sheet(out):
    lib = g.load_geometries(str(RP / "models" / "entity" / "pas_parasite.geo.json"))
    tex = g.load_texture(str(RP / "textures" / "entity" / "pas" / "parasite.png"))
    im, problems = g.uv_map_image(lib.get(), tex, scale=8)
    for pr in problems:
        print("UV problem:", pr)
    im.save(out)
    print("wrote", out)


def scale_ruler(rp, out):
    """Our model only, side view at a fixed scale with 1-block grid lines and the
    player's 0.6 x 1.8 hit box outline (no vanilla textures)."""
    ppu = 10.0
    W, H = 520, 380
    cam = g.Camera(yaw=90, pitch=0, ortho=True, ppu=ppu, target=(0, 16, 0))
    layers, plays, v = entity(rp)
    im = g.render(layers, cam, size=(W, H), plays=plays, variables=v, background="262626")
    dr = ImageDraw.Draw(im)
    y0 = H / 2 + 16 * ppu                     # target y=16 is the image centre -> ground line
    for k in range(3):
        y = y0 - k * 16 * ppu
        dr.line([(0, y), (W, y)], fill=(110, 170, 255, 255), width=1)
        dr.text((4, y - 14), f"{k} block" + ("s" if k != 1 else ""), fill=(150, 200, 255, 255), font=g._font(11))
    # player hit box 0.6 x 1.8 blocks, drawn at the right edge
    x1 = W - 20
    x0 = x1 - 0.6 * 16 * ppu
    dr.rectangle([x0, y0 - 1.8 * 16 * ppu, x1, y0], outline=(240, 240, 240, 255), width=2)
    dr.text((x0 - 4, y0 - 1.8 * 16 * ppu - 16), "player 0.6 x 1.8", fill=(240, 240, 240, 255), font=g._font(11))
    # parasite collision box 0.8 x 0.6 (BP minecraft:collision_box), centred on the origin
    cx = W / 2
    dr.rectangle([cx - 0.4 * 16 * ppu, y0 - 0.6 * 16 * ppu, cx + 0.4 * 16 * ppu, y0], outline=(255, 210, 60, 255), width=1)
    dr.text((cx - 0.4 * 16 * ppu, y0 + 4), "collision box 0.8 x 0.6", fill=(255, 210, 60, 255), font=g._font(11))
    label(im, "pas:parasite scale (side view, 10 px per unit)")
    im.save(out)
    print("wrote", out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--scratch", default=str(DEFAULT_SCRATCH))
    ap.add_argument("--reference", default=str(DEFAULT_REFERENCE_IMG))
    a = ap.parse_args(argv)
    DOCS.mkdir(parents=True, exist_ok=True)
    scratch = Path(a.scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    rp = our_pack()
    views(rp, DOCS / "parasite_views.png")
    walk_t = [round(x, 3) for x in np.linspace(0, 8 / 14, 9)[:-1]]
    frames_sheet(rp, DOCS / "parasite_walk.png", walk_t, WALK_Q, None,
                 "crawl cycle: modified_distance_moved = 14*t, modified_move_speed 0.7 (one gait period = 8 units)",
                 gif=scratch / "parasite_walk.gif")
    att_t = [0.0, 0.06, 0.12, 0.19, 0.26, 0.33, 0.42, 0.55]
    frames_sheet(rp, DOCS / "parasite_attack.png", att_t, dict(LOOK_Q, has_target=1), {"attack_time": 0.3},
                 "attack lunge (controller state 'attack', 0.55 s): wind-up 0.12, strike 0.26, recover",
                 gif=scratch / "parasite_attack.gif")
    poses(rp, DOCS / "parasite_poses.png")
    comparison(rp, DOCS / "parasite_vs_reference.png", a.reference)
    uv_sheet(DOCS / "parasite_uv.png")
    scale_ruler(rp, DOCS / "parasite_scale.png")
    if (DEFAULT_REF / "resource_pack").is_dir():
        scale_check(rp, scratch / "parasite_scale.png")


if __name__ == "__main__":
    main()
