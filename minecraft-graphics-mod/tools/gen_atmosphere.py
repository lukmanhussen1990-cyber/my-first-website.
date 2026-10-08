"""Atmosphere layer: per-biome fog (aerial perspective), water tuning, grass/foliage
colormaps and the matching grass-side overlay colours.

All three presets (lite / standard / ultra) are produced from the same tables,
only the strength knobs in PRESET differ.
"""
from __future__ import annotations

import copy
from pathlib import Path

import numpy as np

from common import (Grade, hex_to_rgb, rgb_to_hex, rgb_to_oklab, oklab_to_rgb, load_json_lenient,
                    write_json, read_rgba, save_image)

# ---------------------------------------------------------------- strength knobs
PRESET = {
    #            overworld haze start (fraction of render dist), weather fog (start, end, mix to grey),
    #            underwater visibility, water opacity, colormap chroma boost, nether fog (start, end)
    "lite":     dict(air_start=0.84, weather=(0.23, 0.70, 0.35), water_end=68, water_alpha=0.60,
                     chroma=1.05, lightness=0.004, nether=(11, 104), end_start=0.92, haze_mix=0.55),
    "standard": dict(air_start=0.66, weather=(0.20, 0.74, 0.50), water_end=82, water_alpha=0.52,
                     chroma=1.16, lightness=0.010, nether=(14, 120), end_start=0.76, haze_mix=0.90),
    "ultra":    dict(air_start=0.50, weather=(0.16, 0.80, 0.55), water_end=98, water_alpha=0.46,
                     chroma=1.28, lightness=0.018, nether=(17, 136), end_start=0.60, haze_mix=1.00),
}

VANILLA_HAZE = "#ABD2FF"

# ---------------------------------------------------------------- climate families
#   haze  = daytime horizon colour, dens = multiplier on the fog start (<1 = thicker haze)
#   water = default surface/underwater colour for the family
FAMILY = {
    "temperate":        dict(haze="#A8D3FF", dens=1.00, water="#3DB8F5", wfog=1.00),
    "temperate_forest": dict(haze="#A6D2F8", dens=0.96, water="#31A9EE", wfog=1.00),
    "dark_forest":      dict(haze="#9DBFD0", dens=0.86, water="#2F8FD8", wfog=0.92),
    "taiga":            dict(haze="#AFCEEA", dens=0.92, water="#2B93C4", wfog=1.00),
    "cold_taiga":       dict(haze="#BCD7F0", dens=0.92, water="#3490CC", wfog=1.00),
    "cold":             dict(haze="#C2DAF2", dens=0.95, water="#3E92D2", wfog=1.00),
    "peaks_snow":       dict(haze="#C8DEF5", dens=1.00, water="#4A9AD8", wfog=1.00),
    "jungle":           dict(haze="#A2D9CC", dens=0.80, water="#1DB8CC", wfog=0.95),
    "swamp":            dict(haze="#B3CBA6", dens=0.55, water="#4E7D63", wfog=0.38),
    "arid_desert":      dict(haze="#E9DFC6", dens=1.10, water="#2EB8B0", wfog=1.05),
    "mesa":             dict(haze="#EAD2B4", dens=1.08, water="#3A9FAE", wfog=1.00),
    "savanna":          dict(haze="#EBDDB6", dens=1.05, water="#28ABBA", wfog=1.00),
    "mountains":        dict(haze="#B3D1F4", dens=1.10, water="#2E98EE", wfog=1.00),
    "ocean":            dict(haze="#A2D7FF", dens=1.10, water="#2088E2", wfog=1.00),
    "ocean_cold":       dict(haze="#B1D6F5", dens=1.05, water="#2C86CE", wfog=0.95),
    "ocean_frozen":     dict(haze="#BCD9F2", dens=1.00, water="#3C88C8", wfog=0.92),
    "ocean_lukewarm":   dict(haze="#A0DBF8", dens=1.12, water="#14B4E8", wfog=1.08),
    "ocean_warm":       dict(haze="#9EE0F2", dens=1.15, water="#14CBDE", wfog=1.12),
    "river":            dict(haze="#A9D4FF", dens=1.00, water="#2D9FF2", wfog=1.00),
    "mushroom":         dict(haze="#CDBFE6", dens=0.90, water="#7F80C4", wfog=0.90),
    "cherry":           dict(haze="#F1D3E4", dens=0.95, water="#5FBFF0", wfog=1.00),
    "cave":             dict(haze=None,      dens=1.00, water="#3AA6D6", wfog=1.00),   # keep vanilla air fog underground
    "nether":           dict(haze=None,      dens=1.00, water="#905957", wfog=1.00),
    "end":              dict(haze=None,      dens=1.00, water="#62529E", wfog=1.00),
}

BIOME_FAMILY = {
    "bamboo_jungle": "jungle", "bamboo_jungle_hills": "jungle", "basalt_deltas": "nether", "beach": "ocean",
    "birch_forest": "temperate_forest", "birch_forest_hills": "temperate_forest",
    "birch_forest_hills_mutated": "temperate_forest", "birch_forest_mutated": "temperate_forest",
    "cherry_grove": "cherry", "cold_beach": "cold", "cold_ocean": "ocean_cold", "cold_taiga": "cold_taiga",
    "cold_taiga_hills": "cold_taiga", "cold_taiga_mutated": "cold_taiga", "crimson_forest": "nether",
    "deep_cold_ocean": "ocean_cold", "deep_dark": "cave", "deep_frozen_ocean": "ocean_frozen",
    "deep_lukewarm_ocean": "ocean_lukewarm", "deep_ocean": "ocean", "deep_warm_ocean": "ocean_warm",
    "desert": "arid_desert", "desert_hills": "arid_desert", "desert_mutated": "arid_desert",
    "dripstone_caves": "cave", "extreme_hills": "mountains", "extreme_hills_edge": "mountains",
    "extreme_hills_mutated": "mountains", "extreme_hills_plus_trees": "mountains",
    "extreme_hills_plus_trees_mutated": "mountains", "flower_forest": "temperate_forest",
    "forest": "temperate_forest", "forest_hills": "temperate_forest", "frozen_ocean": "ocean_frozen",
    "frozen_peaks": "peaks_snow", "frozen_river": "cold", "grove": "cold_taiga", "hell": "nether",
    "ice_mountains": "cold", "ice_plains": "cold", "ice_plains_spikes": "cold", "jagged_peaks": "peaks_snow",
    "jungle": "jungle", "jungle_edge": "jungle", "jungle_edge_mutated": "jungle", "jungle_hills": "jungle",
    "jungle_mutated": "jungle", "legacy_frozen_ocean": "ocean_frozen", "lukewarm_ocean": "ocean_lukewarm",
    "lush_caves": "cave", "mangrove_swamp": "swamp", "meadow": "temperate", "mega_taiga": "taiga",
    "mega_taiga_hills": "taiga", "mega_taiga_mutated": "taiga", "mega_spruce_taiga": "taiga",
    "mega_spruce_taiga_mutated": "taiga", "mesa": "mesa", "mesa_bryce": "mesa", "mesa_mutated": "mesa",
    "mesa_plateau": "mesa", "mesa_plateau_mutated": "mesa", "mesa_plateau_stone": "mesa",
    "mesa_plateau_stone_mutated": "mesa", "mushroom_island": "mushroom", "mushroom_island_shore": "mushroom",
    "ocean": "ocean", "plains": "temperate", "redwood_taiga_hills_mutated": "taiga",
    "redwood_taiga_mutated": "taiga", "river": "river", "roofed_forest": "dark_forest",
    "roofed_forest_mutated": "dark_forest", "savanna": "savanna", "savanna_mutated": "savanna",
    "savanna_plateau": "savanna", "savanna_plateau_mutated": "savanna", "snowy_slopes": "peaks_snow",
    "soulsand_valley": "nether", "stone_beach": "mountains", "stony_peaks": "mountains",
    "sunflower_plains": "temperate", "swampland": "swamp", "swampland_mutated": "swamp", "taiga": "taiga",
    "taiga_hills": "taiga", "taiga_mutated": "taiga", "the_end": "end", "warm_ocean": "ocean_warm",
    "warped_forest": "nether",
}

# per-biome water colour tweaks on top of the family colour
WATER_OVERRIDE = {
    "deep_ocean": "#1A70C8", "deep_cold_ocean": "#2579BE", "deep_frozen_ocean": "#337CBF",
    "deep_lukewarm_ocean": "#10A2DC", "deep_warm_ocean": "#0CB6D8", "beach": "#2BBBEA",
    "cold_beach": "#3C9CD4", "stone_beach": "#2E9AE6", "mangrove_swamp": "#3F8573", "meadow": "#4DBCF6",
    "flower_forest": "#2CB3E8", "lush_caves": "#38BCC0", "dripstone_caves": "#3AA0D6", "deep_dark": "#2A6A8A",
    "swampland_mutated": "#4B7A62",
}
# nether / end keep Mojang's own water colours (they are part of the mood there)
KEEP_VANILLA_WATER = {"hell", "crimson_forest", "warped_forest", "soulsand_valley", "basalt_deltas", "the_end"}


def _mix(a_hex, b_hex, t):
    a, b = hex_to_rgb(a_hex), hex_to_rgb(b_hex)
    return rgb_to_hex(a * (1 - t) + b * t)


def _scale_L(hex_c, k):
    lab = rgb_to_oklab(hex_to_rgb(hex_c))
    lab[0] *= k
    return rgb_to_hex(oklab_to_rgb(lab))


def _air(start, color):
    return {"fog_start": round(float(start), 3), "fog_end": 1.0, "fog_color": color.upper(), "render_distance_type": "render"}


def _weather(start, end, color):
    return {"fog_start": round(float(start), 3), "fog_end": round(float(end), 3), "fog_color": color.upper(), "render_distance_type": "render"}


def _water(color, end):
    c = color.upper()
    return {
        "fog_start": 0.0, "fog_end": round(float(end), 1), "fog_color": c, "render_distance_type": "fixed",
        "transition_fog": {
            "init_fog": {"fog_start": 0.0, "fog_end": 0.01, "fog_color": c, "render_distance_type": "fixed"},
            "min_percent": 0.25, "mid_seconds": 5, "mid_percent": 0.6, "max_seconds": 30,
        },
    }


def biome_water_color(biome):
    fam = BIOME_FAMILY.get(biome, "temperate")
    return WATER_OVERRIDE.get(biome, FAMILY[fam]["water"])


def build_fog(base, fam_name, biome, p, is_default=False):
    """Return a fog JSON dict derived from the vanilla one (`base`) for this family."""
    fog = copy.deepcopy(base)
    dist = fog["minecraft:fog_settings"].setdefault("distance", {})
    fam = FAMILY[fam_name]

    if fam_name == "nether":
        air = dist.get("air")
        if air:  # keep Mojang's colour, push the distances out so the Nether is readable on a phone
            air["fog_start"], air["fog_end"] = float(p["nether"][0]), float(p["nether"][1])
        return fog
    if fam_name == "end":
        air = dist.get("air")
        if air:
            air["fog_start"] = p["end_start"]
            air["fog_color"] = _mix(air["fog_color"], "#1B1128", 0.55 if p is not PRESET["lite"] else 0.0)
        return fog

    if fam["haze"] is not None or is_default:
        haze = fam["haze"] or "#A8D3FF"
        haze = _mix(VANILLA_HAZE, haze, p["haze_mix"])
        start = float(np.clip(p["air_start"] * fam["dens"], 0.25, 0.94))
        dist["air"] = _air(start, haze)
        ws, we, wmix = p["weather"]
        wcol = _mix(haze, "#6E7783", wmix)
        dist["weather"] = _weather(ws * (0.8 + 0.2 * fam["dens"]), we, wcol)

    wc = biome_water_color(biome) if biome else FAMILY["temperate"]["water"]
    if biome in KEEP_VANILLA_WATER:
        return fog
    dist["water"] = _water(_scale_L(wc, 0.88), p["water_end"] * fam["wfog"])
    return fog


HG_NS = "hg"
# Standard (= the base pack) uses plain names; Lite / Ultra use their own so that no two packs or
# subpacks ever define the same fog identifier (a registry that keeps the first definition would
# otherwise silently ignore the preset).
PRESET_TAG = {"standard": "", "lite": "lite_", "ultra": "ultra_"}


def hg_fog_id(vanilla_id: str, preset: str = "standard") -> str:
    """minecraft:fog_plains -> hg:fog_plains / hg:lite_fog_plains / hg:ultra_fog_plains.
    Vanilla fog identifiers cannot be overwritten (Bedrock Wiki, "Overwriting assets"): the
    supported way is a fog under another namespace that biomes_client.json points to."""
    return f"{HG_NS}:{PRESET_TAG[preset]}{vanilla_id.split(':', 1)[1]}"


def fog_file_name(stem: str, preset: str) -> str:
    """plains_fog_setting.json -> hg_plains_fog_setting.json / hg_lite_... / hg_ultra_..."""
    return f"hg_{PRESET_TAG[preset]}{stem}"


def generate_fogs(vanilla, out_dir: Path, preset: str, write=True):
    p = PRESET[preset]
    vb = load_json_lenient(vanilla / "biomes_client.json")["biomes"]
    # fog identifier -> biomes using it
    fog_users = {}
    for b, v in vb.items():
        fog_users.setdefault(v["fog_identifier"], []).append(b)

    fogs_out = {}
    for f in sorted((vanilla / "fogs").glob("*.json")):
        base = load_json_lenient(f)
        ident = base["minecraft:fog_settings"]["description"]["identifier"]
        if ident == "minecraft:fog_powder_snow":
            continue                       # untouched (not biome-bound)
        users = fog_users.get(ident, [])
        if ident == "minecraft:fog_default":
            fog = build_fog(base, "temperate", None, p, is_default=True)
        else:
            biome = users[0] if users else f.stem.replace("_fog_setting", "")
            fam = BIOME_FAMILY.get(biome, "temperate")
            fog = build_fog(base, fam, biome, p)
        fog["minecraft:fog_settings"]["description"]["identifier"] = hg_fog_id(ident, preset)
        name = fog_file_name(f.name, preset)
        fogs_out[name] = fog
        if write:
            write_json(out_dir / "fogs" / name, fog)
    return fogs_out


NEW_BIOMES = ["birch_forest_hills_mutated", "birch_forest_mutated", "deep_dark", "desert_mutated", "dripstone_caves",
              "frozen_peaks", "grove", "jagged_peaks", "jungle_edge_mutated", "legacy_frozen_ocean", "lush_caves",
              "meadow", "mesa_plateau_mutated", "mesa_plateau_stone_mutated", "redwood_taiga_hills_mutated",
              "redwood_taiga_mutated", "roofed_forest_mutated", "savanna_plateau_mutated", "snowy_slopes", "stony_peaks"]


def generate_biomes_and_new_fogs(vanilla, out_dir: Path, preset: str, write_fogs=True, fog_preset=None):
    p = PRESET[preset]
    fp = fog_preset or preset            # which preset's fog ids the biome entries point to
    vb = load_json_lenient(vanilla / "biomes_client.json")["biomes"]
    template = {"format_version": "1.16.100",
                "minecraft:fog_settings": {"description": {"identifier": ""}, "distance": {}}}
    out = {}

    def entry(fog_id, water_hex, alpha, extra=None):
        d = {"fog_identifier": fog_id, "fog_ids_to_merge": [fog_id], "inherit_from_prior_fog": False,
             "water_surface_color": water_hex.upper(), "water_surface_transparency": round(alpha, 2)}
        if extra:
            d.update(extra)
        return d

    # vanilla-listed biomes keep their (re-generated) fog ids
    for b, v in vb.items():
        fam = BIOME_FAMILY.get(b, "temperate")
        if b == "default":
            out[b] = entry(hg_fog_id(v["fog_identifier"], fp), FAMILY["temperate"]["water"], p["water_alpha"], {"remove_all_prior_fog": False})
            continue
        wc = v["water_surface_color"] if b in KEEP_VANILLA_WATER else biome_water_color(b)
        alpha = p["water_alpha"]
        if fam == "swamp":
            alpha = min(0.97, p["water_alpha"] + 0.42)
        elif fam in ("nether", "end"):
            alpha = v.get("water_surface_transparency", 0.65)
        out[b] = entry(hg_fog_id(v["fog_identifier"], fp), wc, alpha)

    # new biomes: dedicated fog ids so each can have its own atmosphere
    for b in NEW_BIOMES:
        fam = BIOME_FAMILY[b]
        fid = f"{HG_NS}:{PRESET_TAG[fp]}fog_{b}"
        fog = build_fog(copy.deepcopy(template), fam, b, p)
        fog["minecraft:fog_settings"]["description"]["identifier"] = fid
        if not fog["minecraft:fog_settings"]["distance"]:
            # cave biomes: only water colour is customised; air stays vanilla
            fog["minecraft:fog_settings"]["distance"] = {"water": _water(_scale_L(biome_water_color(b), 0.88), p["water_end"])}
        if write_fogs:
            write_json(out_dir / "fogs" / fog_file_name(f"{b}_fog_setting.json", fp), fog)
        alpha = min(0.97, p["water_alpha"] + 0.42) if fam == "swamp" else p["water_alpha"]
        out[b] = entry(fid, biome_water_color(b), alpha)

    write_json(out_dir / "biomes_client.json", {"biomes": dict(sorted(out.items()))})
    return out


# ---------------------------------------------------------------- colormaps + overlay
def preset_grade(preset, swampy=False):
    p = PRESET[preset]
    c = 1.0 + (p["chroma"] - 1.0) * (0.55 if swampy else 1.0)
    return Grade(chroma=c, lightness=p["lightness"])


def generate_colormaps(vanilla, out_dir: Path, preset: str):
    cm = vanilla / "textures" / "colormap"
    for f in sorted(cm.glob("*.png")):
        arr = read_rgba(f)
        g = preset_grade(preset, swampy=("swamp" in f.stem or "mangrove" in f.stem))
        out = g.apply_array(arr)
        save_image(out, out_dir / "textures" / "colormap" / f.name)


def generate_terrain_overlay(vanilla, out_dir: Path, preset: str):
    """grass_side overlay colours + lily pad tint must go through the *same* grade as
    grass.png, otherwise the side fringe of grass blocks would not match the top."""
    tt = load_json_lenient(vanilla / "textures" / "terrain_texture.json")
    td = tt["texture_data"]
    g = preset_grade(preset)
    gs = copy.deepcopy(td["grass_side"])
    for t in gs["textures"]:
        if isinstance(t, dict) and "overlay_color" in t:
            t["overlay_color"] = g.apply_hex(t["overlay_color"]).lower()
    wl = copy.deepcopy(td["waterlily"])
    for t in wl["textures"] if isinstance(wl["textures"], list) else []:
        if isinstance(t, dict) and "tint_color" in t:
            t["tint_color"] = g.apply_hex(t["tint_color"]).lower()
    out = {"resource_pack_name": tt["resource_pack_name"], "texture_name": tt["texture_name"],
           "padding": tt["padding"], "num_mip_levels": tt["num_mip_levels"],
           "texture_data": {"grass_side": gs, "waterlily": wl}}
    write_json(out_dir / "textures" / "terrain_texture.json", out)


def generate(vanilla: Path, out_dir: Path, preset: str, own_fogs=True):
    """own_fogs=False (the 'standard' subpack): reuse the base pack's fog definitions and
    only write the files that are safe to repeat (biomes_client / colormaps / overlay)."""
    generate_fogs(vanilla, out_dir, preset, write=own_fogs)
    generate_biomes_and_new_fogs(vanilla, out_dir, preset, write_fogs=own_fogs)
    generate_colormaps(vanilla, out_dir, preset)
    generate_terrain_overlay(vanilla, out_dir, preset)
