#!/usr/bin/env python3
"""Asset preview sheet for the README (docs/asset_preview.png).

NOT an in-game screenshot - it shows the generated assets (sun, moon, clouds, water,
colour map, haze/water palette, vignette) the way the game would blend them, so you can
see what the pack contains before installing it.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, PACK_DIR, hex_to_rgb

OUT = ROOT / "docs" / "asset_preview.png"


def additive(path, bg, scale):
    a = np.array(Image.open(path).convert("RGB")).astype(int)
    r = np.clip(a + np.array(bg), 0, 255).astype(np.uint8)
    return Image.fromarray(r).resize((a.shape[1] * scale, a.shape[0] * scale), Image.BICUBIC)


def main():
    pk = PACK_DIR
    ultra = pk / "subpacks" / "ultra"
    W = 1180
    sheet = Image.new("RGB", (W, 1100), (24, 28, 40))
    d = ImageDraw.Draw(sheet)
    white = (235, 240, 250)

    def label(x, y, t):
        d.text((x, y), t, fill=white)

    # --- sky bodies
    label(10, 6, "Sun (additive bloom)")
    sheet.paste(additive(pk / "textures/environment/sun.png", (40, 80, 150), 6), (10, 22))
    label(214, 6, "Moon, 8 phases")
    sheet.paste(additive(pk / "textures/environment/moon_phases.png", (8, 10, 28), 3), (214, 22))
    label(606, 6, "Clouds (Ultra) - white = cloud")
    cl = Image.open(ultra / "textures/environment/clouds.png").convert("RGBA")
    bg = Image.new("RGBA", cl.size, (60, 110, 190, 255))
    bg.alpha_composite(cl)
    sheet.paste(bg.convert("RGB").resize((256, 256), Image.NEAREST).crop((0, 0, 256, 192)), (606, 22))
    label(878, 6, "Rain / snow sprites")
    wa = Image.open(pk / "textures/environment/weather.png").convert("RGBA")
    wb = Image.new("RGBA", wa.size, (70, 80, 100, 255))
    wb.alpha_composite(wa)
    sheet.paste(wb.convert("RGB").resize((192, 192), Image.NEAREST), (878, 22))

    # --- water, tinted like the game does (grey texture x biome colour)
    y0 = 236
    label(10, y0, "Animated water (frames 0 / 10 / 20), tinted #3DB8F5 - 6x6 tiles")
    ws = np.array(Image.open(pk / "textures/blocks/water_still_grey.png").convert("RGB")).astype(float) / 255
    tint = hex_to_rgb("#3DB8F5")
    for i, t in enumerate((0, 10, 20)):
        tile = ws[t * 16:(t + 1) * 16]
        big = np.tile(tile, (6, 6, 1)) * tint
        im = Image.fromarray((big * 255).astype(np.uint8)).resize((96 * 3, 96 * 3), Image.NEAREST)
        sheet.paste(im, (10 + i * 296, y0 + 16))

    # --- grass colour map + haze palette
    y1 = y0 + 16 + 296
    label(10, y1, "Grass colour map (Ultra)")
    gm = Image.open(ultra / "textures/colormap/grass.png").convert("RGBA")
    gb = Image.new("RGBA", gm.size, (24, 28, 40, 255))
    gb.alpha_composite(gm)
    sheet.paste(gb.convert("RGB").resize((256, 256)), (10, y1 + 16))
    label(290, y1, "Foliage colour map (Ultra)")
    fm = Image.open(ultra / "textures/colormap/foliage.png").convert("RGBA")
    fb = Image.new("RGBA", fm.size, (24, 28, 40, 255))
    fb.alpha_composite(fm)
    sheet.paste(fb.convert("RGB").resize((256, 256)), (290, y1 + 16))

    label(580, y1, "Ultra horizon haze (top) and water colour (bottom) per biome")
    bc = json.loads((ultra / "biomes_client.json").read_text())["biomes"]
    names = ["plains", "forest", "taiga", "ice_plains", "jungle", "swampland", "desert", "savanna", "mesa", "extreme_hills",
             "ocean", "warm_ocean", "cherry_grove", "mushroom_island", "meadow", "river"]
    fogs = {}
    for f in (pk / "fogs").glob("*.json"):          # every preset's fogs live in the base pack (unique ids)
        fj = json.loads(f.read_text())["minecraft:fog_settings"]
        fogs[fj["description"]["identifier"]] = fj
    cw, ch = 94, 52
    for i, n in enumerate(names):
        r, c = divmod(i, 6)
        e = bc[n]
        fog = fogs[e["fog_identifier"]]["distance"]
        hz = fog.get("air", {}).get("fog_color", "#A8D3FF")
        x, y = 580 + c * (cw + 4), y1 + 16 + r * (ch * 2 + 26)
        d.rectangle([x, y, x + cw, y + ch], fill=hz)
        d.rectangle([x, y + ch, x + cw, y + ch * 2], fill=e["water_surface_color"])
        d.text((x + 3, y + ch * 2 + 4), n[:14], fill=white)

    # --- sample of graded textures
    n_rows = (len(names) + 5) // 6
    y2 = y1 + 16 + max(256, n_rows * (ch * 2 + 26)) + 10
    label(10, y2, "Graded block textures (from the pack)")
    names_t = ["stone", "cobblestone", "dirt", "sand", "log_oak", "planks_oak", "brick", "coal_ore", "iron_ore", "gold_ore",
               "diamond_ore", "emerald_ore", "redstone_ore", "lapis_ore", "glowstone", "sea_lantern", "netherrack", "obsidian",
               "bookshelf", "crafting_table_front", "furnace_front_on", "grass_top", "leaves_oak_opaque", "ice"]
    x = 10
    for n in names_t:
        for ext in (".png", ".tga"):
            p = pk / "textures" / "blocks" / f"{n}{ext}"
            if p.exists():
                im = Image.open(p).convert("RGBA")
                if n in ("grass_top", "leaves_oak_opaque"):          # tinted in game: show with a plains-green tint
                    a = np.array(im).astype(float)
                    a[..., :3] *= np.array([0.56, 0.78, 0.34])
                    im = Image.fromarray(a.astype(np.uint8))
                bgi = Image.new("RGBA", im.size, (255, 0, 255, 255))
                bgi.alpha_composite(im)
                sheet.paste(bgi.convert("RGB").resize((44, 44), Image.NEAREST), (x, y2 + 16))
                x += 48
                break
    sheet = sheet.crop((0, 0, W, y2 + 16 + 54))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, optimize=True)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
