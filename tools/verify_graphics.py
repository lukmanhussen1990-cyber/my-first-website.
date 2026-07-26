#!/usr/bin/env python3
"""Range-check the Vibrant Visuals graphics pack against the documented schemas.

Every limit below is taken from the Minecraft creator documentation:
  learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/

Out-of-range values are logged as CONTENT_ERROR by the game and the whole
settings file is dropped, so this is worth checking before shipping.

Run from the repo root:  python3 tools/verify_graphics.py
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "VIS_RP")

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
errors = []


def load(*parts):
    with open(os.path.join(PACK, *parts), encoding="utf-8") as fh:
        return json.load(fh)


def values_of(field, node):
    """A field is either a scalar or a keyframe map {time: value}."""
    if isinstance(node, dict):
        for key, val in node.items():
            try:
                t = float(key)
            except ValueError:
                errors.append(f"{field}: keyframe key {key!r} is not a number")
                continue
            if not 0.0 <= t <= 1.0:
                errors.append(f"{field}: keyframe time {t} is outside 0.0-1.0")
            yield f"{field}[{key}]", val
    else:
        yield field, node


def check_range(field, node, lo, hi):
    for name, val in values_of(field, node):
        if not isinstance(val, (int, float)):
            errors.append(f"{name}: expected a number, got {val!r}")
        elif not lo <= val <= hi:
            errors.append(f"{name}: {val} is outside the documented range {lo}-{hi}")


def check_color(field, node):
    for name, val in values_of(field, node):
        if isinstance(val, str):
            if not HEX_RE.match(val):
                errors.append(f"{name}: {val!r} is not a 6-digit hex colour")
        elif isinstance(val, list):
            if len(val) != 3:
                errors.append(f"{name}: colour needs 3 channels, got {len(val)}")
            for chan in val:
                if not 0 <= chan <= 255:
                    errors.append(f"{name}: channel {chan} is outside 0-255")
        else:
            errors.append(f"{name}: {val!r} is not a colour")


def check_triplet(field, node, lo, hi):
    if not isinstance(node, list) or len(node) != 3:
        errors.append(f"{field}: expected 3 values, got {node!r}")
        return
    for i, val in enumerate(node):
        if not lo <= val <= hi:
            errors.append(f"{field}[{i}]: {val} is outside {lo}-{hi}")


def check_manifest():
    m = load("manifest.json")
    if m.get("capabilities") != ["pbr"]:
        errors.append('manifest.json: needs "capabilities": ["pbr"] for Vibrant Visuals')
    ver = m["header"]["min_engine_version"]
    if ver < [1, 21, 120]:
        errors.append(f"manifest.json: min_engine_version {ver} is below the 1.21.120 the pbr capability requires")


def check_lighting():
    s = load("lighting", "global.json")["minecraft:lighting_settings"]
    orbital = s["directional_lights"]["orbital"]
    for body in ("sun", "moon"):
        check_range(f"lighting.{body}.illuminance", orbital[body]["illuminance"], 0.0, 200000.0)
        check_color(f"lighting.{body}.color", orbital[body]["color"])
    check_range("lighting.orbital_offset_degrees", orbital["orbital_offset_degrees"], -360.0, 360.0)
    check_range("lighting.emissive.desaturation", s["emissive"]["desaturation"], 0.0, 1.0)
    check_range("lighting.ambient.illuminance", s["ambient"]["illuminance"], 0.0, 5.0)
    check_color("lighting.ambient.color", s["ambient"]["color"])
    check_range("lighting.sky.intensity", s["sky"]["intensity"], 0.1, 1.0)


def check_atmospherics():
    s = load("atmospherics", "atmospherics.json")["minecraft:atmosphere_settings"]
    for key in ("min", "start", "mie_start", "max"):
        check_range(f"atmospherics.horizon_blend_stops.{key}", s["horizon_blend_stops"][key], 0.0, 2.0)
    for key in ("rayleigh_strength", "sun_mie_strength", "moon_mie_strength"):
        check_range(f"atmospherics.{key}", s[key], 0.0, 10.0)
    check_range("atmospherics.sun_glare_shape", s["sun_glare_shape"], 0.0, 64.0)
    check_color("atmospherics.sky_zenith_color", s["sky_zenith_color"])
    check_color("atmospherics.sky_horizon_color", s["sky_horizon_color"])


def check_water():
    s = load("water", "water.json")["minecraft:water_settings"]
    p = s["particle_concentrations"]
    check_range("water.cdom", p["cdom"], 0.0, 15.0)
    check_range("water.chlorophyll", p["chlorophyll"], 0.0, 10.0)
    check_range("water.suspended_sediment", p["suspended_sediment"], 0.0, 300.0)

    w = s["waves"]
    for key, lo, hi in (("depth", 0.0, 3.0), ("direction_increment", 0.0, 360.0),
                        ("frequency", 0.01, 3.0), ("frequency_scaling", 0.0, 2.0),
                        ("mix", 0.0, 1.0), ("octaves", 1, 30), ("pull", -1.0, 1.0),
                        ("sampleWidth", 0.01, 1.0), ("shape", 1.0, 10.0),
                        ("speed", 0.01, 10.0), ("speed_scaling", 0.0, 2.0)):
        check_range(f"water.waves.{key}", w[key], lo, hi)
    if not isinstance(w["octaves"], int):
        errors.append("water.waves.octaves must be an integer")

    c = s["caustics"]
    check_range("water.caustics.frame_length", c["frame_length"], 0.01, 5.0)
    check_range("water.caustics.power", c["power"], 1, 6)
    check_range("water.caustics.scale", c["scale"], 0.1, 5.0)
    if not isinstance(c["power"], int):
        errors.append("water.caustics.power must be an integer")


def check_color_grading():
    s = load("color_grading", "color_grading.json")["minecraft:color_grading_settings"]
    cg = s["color_grading"]
    limits = (("contrast", 0.0, 4.0), ("gain", 0.0, 10.0), ("gamma", 0.0, 4.0),
              ("offset", -1.0, 1.0), ("saturation", 0.0, 10.0))
    for band in ("midtones", "shadows", "highlights"):
        if band not in cg:
            continue
        for key, lo, hi in limits:
            if key in cg[band]:
                check_triplet(f"color_grading.{band}.{key}", cg[band][key], lo, hi)

    shadows_max = cg.get("shadows", {}).get("shadowsMax")
    highlights_min = cg.get("highlights", {}).get("highlightsMin")
    if shadows_max is not None:
        check_range("color_grading.shadows.shadowsMax", shadows_max, 0.1, 1.0)
    if highlights_min is not None:
        check_range("color_grading.highlights.highlightsMin", highlights_min, 1.0, 4.0)
    if shadows_max is not None and shadows_max == highlights_min:
        errors.append("color_grading: shadowsMax must not equal highlightsMin")
    for band in ("shadows", "highlights", "temperature"):
        if band in cg and cg[band].get("enabled") is not True:
            errors.append(f'color_grading.{band}: needs "enabled": true to take effect')

    temp = cg.get("temperature", {})
    if "temperature" in temp:
        check_range("color_grading.temperature.temperature", temp["temperature"], 1000.0, 15000.0)
    if temp.get("type") not in (None, "white_balance", "color_temperature"):
        errors.append(f"color_grading.temperature.type: {temp['type']!r} is not a valid type")

    operators = {"reinhard", "reinhard_luma", "reinhard_luminance", "hable", "aces", "generic"}
    op = s["tone_mapping"]["operator"]
    if op not in operators:
        errors.append(f"tone_mapping.operator: {op!r} is not one of {sorted(operators)}")


def check_local_lighting():
    s = load("local_lighting", "local_lighting.json")["minecraft:local_light_settings"]
    for block, cfg in s.items():
        if not block.startswith("minecraft:"):
            errors.append(f"local_lighting: {block!r} needs a namespace")
        if cfg.get("light_type") not in ("static_light", "point_light"):
            errors.append(f"local_lighting.{block}: light_type {cfg.get('light_type')!r} is invalid")
        check_color(f"local_lighting.{block}.light_color", cfg["light_color"])


def check_pbr():
    s = load("pbr", "global.json")["minecraft:pbr_fallback_settings"]
    for group in ("blocks", "actors", "particles", "items"):
        vals = s[group]["global_metalness_emissive_roughness_subsurface"]
        if len(vals) != 4:
            errors.append(f"pbr.{group}: MERS needs 4 channels, got {len(vals)}")
        for i, val in enumerate(vals):
            if not 0 <= val <= 255:
                errors.append(f"pbr.{group}[{i}]: {val} is outside 0-255")


def main():
    check_manifest()
    check_lighting()
    check_atmospherics()
    check_water()
    check_color_grading()
    check_local_lighting()
    check_pbr()

    if errors:
        print("FAILED graphics pack verification:")
        for err in errors:
            print("  -", err)
        return 1
    print("graphics pack verified: every value is inside its documented range")
    return 0


if __name__ == "__main__":
    sys.exit(main())
