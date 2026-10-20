"""Preview renders (turnaround sheets, first/third person shots)."""
import numpy as np
from PIL import Image, ImageDraw

from .rig import (Model, look_at_camera, first_person_camera, player_rig_matrices,
                  binding_matrix)
from .render import Renderer, collect_quads


def model_from_geo(geo):
    return Model.from_geo(geo["minecraft:geometry"][0])


def _gun_quads(model, tex, gun_anim=None, bound=None, extra=None):
    anims = {"gun": gun_anim or {}}
    if extra:
        anims.update(extra)
    mats = model.world_matrices(anims, bound=bound if bound is not None else np.eye(4))
    return collect_quads(model, mats, texture=tex.astype(float) / 255.0)


def turnaround(geo, tex, path, size=(1200, 900), title=None):
    m = model_from_geo(geo)
    q = _gun_quads(m, tex)
    pts = np.vstack([v for v, *_ in q])
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    c = (lo + hi) / 2
    span = float(np.max(hi - lo))
    W, H = size
    sheet = Image.new("RGBA", (W, H), (32, 36, 44, 255))
    views = [
        ("right", np.array([1, 0, 0])),
        ("left", np.array([-1, 0, 0])),
        ("3/4 front", np.array([0.9, 0.55, -1.0])),
        ("3/4 rear", np.array([-0.8, 0.6, 1.0])),
    ]
    cell_w, cell_h = W // 2, H // 2
    for i, (name, d) in enumerate(views):
        r = Renderer(cell_w, cell_h, fov_v=30, bg=(32, 36, 44, 255), ss=2)
        d = d / np.linalg.norm(d)
        if name in ("right", "left"):
            r.set_ortho(cell_w * 0.9 / span)
            eye = c + d * 200
            cam = look_at_camera(eye, c)
        else:
            dist = span / (2 * np.tan(np.radians(15))) * 1.15
            cam = look_at_camera(c + d * dist, c)
        r.draw(q, cam)
        img = r.image()
        sheet.paste(img, ((i % 2) * cell_w, (i // 2) * cell_h))
    if title:
        ImageDraw.Draw(sheet).text((10, 8), title, fill=(230, 230, 230, 255))
    sheet.save(path)


def first_person(geo, tex, player, gun_anim, path, size=(1080, 486), fov=70,
                 bg=(126, 170, 214, 255), extra=None):
    m = model_from_geo(geo)
    pm = player_rig_matrices(player, True)
    B = binding_matrix(pm, player)
    q = _gun_quads(m, tex, gun_anim, B, extra)
    r = Renderer(size[0], size[1], fov_v=fov, bg=bg, near=0.3, ss=2)
    r.draw(q, first_person_camera())
    img = r.image()
    d = ImageDraw.Draw(img)
    cx, cy = size[0] // 2, size[1] // 2
    d.line((cx - 8, cy, cx + 8, cy), fill=(255, 255, 255, 255))
    d.line((cx, cy - 8, cx, cy + 8), fill=(255, 255, 255, 255))
    img.save(path)
    return img


def third_person(geo, tex, player, gun_anim, path, eye=(-38, 26, -40), size=(700, 700),
                 player_color=True, extra=None):
    m = model_from_geo(geo)
    pm = player_rig_matrices(player, False)
    B = binding_matrix(pm, player)
    q = _gun_quads(m, tex, gun_anim, B, extra)
    cols = {"rightArm": (222, 170, 130), "leftArm": (222, 170, 130), "body": (40, 160, 170),
            "head": (150, 110, 80), "rightLeg": (50, 60, 160), "leftLeg": (50, 60, 160)}
    skip = [b for b in player.order if b not in cols]
    for b, col in cols.items():
        for cu in player.bones[b].cubes:
            cu.color = col
    q += collect_quads(player, pm, skip_bones=skip)
    r = Renderer(size[0], size[1], fov_v=45, bg=(126, 170, 214, 255), ss=2)
    r.draw(q, look_at_camera(eye, (0, 17, 0)))
    r.image().save(path)
